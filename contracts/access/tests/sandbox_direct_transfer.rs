#![cfg(unix)]
use near_workspaces::{Account, Worker, network::Sandbox, types::{AccountId, Gas, KeyType, NearToken, SecretKey}};
use serde_json::{json, Value};

async fn local_account(w: &Worker<Sandbox>, f: &Account, seed: &str) -> Account {
    let k = SecretKey::from_seed(KeyType::ED25519, seed);
    let id: AccountId = k.public_key().key_data().iter().map(|b| format!("{b:02x}")).collect::<String>().parse().unwrap();
    assert_eq!(id.len(), 64);
    f.transfer_near(&id, NearToken::from_near(5)).await.unwrap().into_result().unwrap();
    Account::from_secret_key(id, k, w)
}
async fn credit(c: &near_workspaces::Contract, id: &AccountId) -> u128 {
    let s: String = c.view("storage_balance_of").args_json(json!({"account_id":id})).await.unwrap().json().unwrap();
    s.parse().unwrap()
}
async fn license(c: &near_workspaces::Contract, id: &str) -> Value {
    c.view("get_license").args_json(json!({"token_id":id})).await.unwrap().json().unwrap()
}
async fn supply(c: &near_workspaces::Contract, id: &AccountId) -> String {
    c.view("nft_supply_for_owner").args_json(json!({"account_id":id})).await.unwrap().json().unwrap()
}
async fn mint(c: &near_workspaces::Contract, ft: &Account, buyer: &Account, trader: &Account, id: &str) -> String {
    let msg = json!({"action":"purchase", "trader_id":trader.id(), "plan_version":1, "purchase_id":id}).to_string();
    let r = ft.call(c.id(),"ft_on_transfer").args_json(json!({"sender_id":buyer.id(),"amount":"101","msg":msg})).gas(Gas::from_tgas(100)).transact().await.unwrap();
    assert_eq!(r.json::<String>().unwrap(),"0");
    format!("kf-{}-{}-{}",trader.id(),buyer.id(),id)
}
#[tokio::test]
async fn direct_transfer_charges_growth_and_rolls_back_insufficient_credit() {
    let w=near_workspaces::sandbox().await.unwrap();
    println!("PROTOCOL {}",w.view_block().await.unwrap().header().latest_protocol_version());
    let f=w.dev_create_account().await.unwrap();
    let buyer=local_account(&w,&f,"kf-direct-buyer").await;
    let trader=local_account(&w,&f,"kf-direct-trader").await;
    let recipient=local_account(&w,&f,"kf-direct-recipient").await;
    let recipient2=local_account(&w,&f,"kf-direct-recipient2").await;
    let monitor=local_account(&w,&f,"kf-direct-monitor").await;
    let ft=local_account(&w,&f,"kf-direct-ft").await;
    let wasm=std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"),"/target/wasm32-unknown-unknown/release/access.wasm")).unwrap();
    let c=w.dev_deploy(&wasm).await.unwrap();
    c.call("new").args_json(json!({"owner_id":trader.id(),"monitor_id":monitor.id(),"ft_id":ft.id()})).transact().await.unwrap().into_result().unwrap();
    trader.call(c.id(),"set_plan").args_json(json!({"trader_id":trader.id(),"version":1,"price":"101","term_ms":1000000})).transact().await.unwrap().into_result().unwrap();
    buyer.call(c.id(),"storage_deposit").args_json(json!({"account_id":null})).deposit(NearToken::from_near(1)).transact().await.unwrap().into_result().unwrap();
    let first=mint(&c,&ft,&buyer,&trader,&"x".repeat(128)).await;
    let second=mint(&c,&ft,&buyer,&trader,&"y".repeat(128)).await;
    let before=c.view_account().await.unwrap().storage_usage;
    let before_credit=credit(&c,buyer.id()).await;
    let prior=license(&c,&first).await;
    let success=buyer.call(c.id(),"nft_transfer").args_json(json!({"receiver_id":recipient.id(),"token_id":first,"approval_id":null,"memo":null})).deposit(NearToken::from_yoctonear(1)).gas(Gas::from_tgas(100)).transact().await.unwrap();
    assert!(success.is_success(),"{:?}",success.failures());
    let after=c.view_account().await.unwrap().storage_usage;
    let after_credit=credit(&c,buyer.id()).await;
    assert!(after>before);
    assert_eq!(before_credit-after_credit, u128::from(after-before)*10u128.pow(19));
    assert_eq!(credit(&c,recipient.id()).await,0);
    let current=license(&c,&first).await;
    assert_eq!(current["owner_id"],json!(recipient.id()));
    assert_eq!(current["access_epoch"],2);
    assert_eq!(current["expires_at_ms"],prior["expires_at_ms"]);
    assert_eq!(current["trader_id"],prior["trader_id"]);
    assert_eq!(current["access_active"],prior["access_active"]);
    assert_eq!(supply(&c,buyer.id()).await,"1");
    assert_eq!(supply(&c,recipient.id()).await,"1");
    println!("DIRECT_SUCCESS storage_before={before} storage_after={after} growth={} credit_before={before_credit} credit_after={after_credit} gas={} tx={} receipts={}",after-before,success.total_gas_burnt.as_gas(),success.outcome().gas_burnt.as_gas(),success.total_gas_burnt.as_gas()-success.outcome().gas_burnt.as_gas());
    let third=mint(&c,&ft,&buyer,&trader,&"z".repeat(128)).await;
    let withdrawal=buyer.call(c.id(),"storage_withdraw").args_json(json!({"amount":null})).deposit(NearToken::from_yoctonear(1)).gas(Gas::from_tgas(250)).transact().await.unwrap();
    assert!(withdrawal.failures().is_empty(),"{:?}",withdrawal.failures());
    assert_eq!(credit(&c,buyer.id()).await,0);
    let before=c.view_account().await.unwrap().storage_usage;
    let prior=license(&c,&second).await;
    let prior_other=license(&c,&third).await;
    let failed=buyer.call(c.id(),"nft_transfer").args_json(json!({"receiver_id":recipient2.id(),"token_id":second,"approval_id":null,"memo":null})).deposit(NearToken::from_yoctonear(1)).gas(Gas::from_tgas(100)).transact().await.unwrap();
    assert!(failed.is_failure());
    assert!(format!("{:?}", failed.failures()).contains("insufficient prepaid storage"));
    assert_eq!(before,c.view_account().await.unwrap().storage_usage);
    assert_eq!(credit(&c,buyer.id()).await,0);
    assert_eq!(license(&c,&second).await,prior);
    assert_eq!(license(&c,&third).await,prior_other);
    assert_eq!(supply(&c,buyer.id()).await,"2");
    assert_eq!(supply(&c,recipient2.id()).await,"0");
    println!("DIRECT_FAILURE storage={before} credit=0 gas={} tx={} receipts={}",failed.total_gas_burnt.as_gas(),failed.outcome().gas_burnt.as_gas(),failed.total_gas_burnt.as_gas()-failed.outcome().gas_burnt.as_gas());
}
