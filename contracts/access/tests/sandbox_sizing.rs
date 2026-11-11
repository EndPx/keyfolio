#![cfg(unix)]
use near_workspaces::{Account, Worker, network::Sandbox, types::{AccountId, Gas, KeyType, NearToken, SecretKey}};
use near_workspaces::result::ExecutionFinalResult;
use serde_json::json;
async fn implicit(w: &Worker<Sandbox>, f: &Account, seed: &str) -> Account {
    let k = SecretKey::from_seed(KeyType::ED25519, seed);
    let id: AccountId = k.public_key().key_data().iter().map(|b| format!("{b:02x}")).collect::<String>().parse().unwrap();
    assert_eq!(id.len(), 64);
    f.transfer_near(&id, NearToken::from_near(5)).await.unwrap().into_result().unwrap();
    Account::from_secret_key(id, k, w)
}
fn record(label: &str, o: &ExecutionFinalResult, prepaid: Option<u64>) {
    assert!(o.is_success(), "{label}: {:?}", o.failures());
    let sum: u64 = o.outcomes().iter().map(|v| v.gas_burnt.as_gas()).sum();
    assert_eq!(sum, o.total_gas_burnt.as_gas());
    println!("SIZE_GAS {label} total={sum} transaction={} receipts={} prepaid_tgas={prepaid:?}", o.outcome().gas_burnt.as_gas(), sum-o.outcome().gas_burnt.as_gas());
}
#[tokio::test]
async fn exact_artifact_sizing() {
    let w = near_workspaces::sandbox().await.unwrap();
    println!("SIZE_PROTOCOL {}", w.view_block().await.unwrap().header().latest_protocol_version());
    let f = w.dev_create_account().await.unwrap();
    let owner = implicit(&w,&f,"kf05-local-owner").await;
    let monitor = implicit(&w,&f,"kf05-local-monitor").await;
    let trader = implicit(&w,&f,"kf05-local-trader").await;
    let buyer = implicit(&w,&f,"kf05-local-buyer").await;
    let ft = implicit(&w,&f,"kf05-local-ft").await;
    let a = w.dev_create_account().await.unwrap();
    println!("SIZE_STORAGE before_deploy {}", a.view_account().await.unwrap().storage_usage);
    let wasm = std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"),"/target/wasm32-unknown-unknown/release/access.wasm")).unwrap();
    let deployed = a.deploy(&wasm).await.unwrap();
    record("deploy", &deployed.details,None);
    let c = deployed.into_result().unwrap();
    println!("SIZE_STORAGE after_deploy {}", c.view_account().await.unwrap().storage_usage);
    let o = c.call("new").args_json(json!({"owner_id":owner.id(),"monitor_id":monitor.id(),"ft_id":ft.id()})).gas(Gas::from_tgas(100)).transact().await.unwrap();
    record("new",&o,Some(100));
    println!("SIZE_STORAGE after_new {}",c.view_account().await.unwrap().storage_usage);
    let o = owner.call(c.id(),"set_plan").args_json(json!({"trader_id":trader.id(),"version":1,"price":"101","term_ms":1000000})).gas(Gas::from_tgas(100)).transact().await.unwrap();
    record("set_plan",&o,Some(100));
    println!("SIZE_STORAGE after_plan {}",c.view_account().await.unwrap().storage_usage);
    let before_tiny = c.view_account().await.unwrap().storage_usage;
    let tiny = buyer.call(c.id(),"storage_deposit").args_json(json!({"account_id":null})).deposit(NearToken::from_yoctonear(1)).gas(Gas::from_tgas(100)).transact().await.unwrap();
    assert!(tiny.is_failure());
    assert_eq!(c.view_account().await.unwrap().storage_usage, before_tiny);
    let o = buyer.call(c.id(),"storage_deposit").args_json(json!({"account_id":null})).deposit(NearToken::from_near(1)).gas(Gas::from_tgas(100)).transact().await.unwrap();
    record("storage_deposit",&o,Some(100));
    println!("SIZE_STORAGE after_storage_deposit {}",c.view_account().await.unwrap().storage_usage);
    let after_deposit = c.view_account().await.unwrap().storage_usage;
    let credit: String = c.view("storage_balance_of").args_json(json!({"account_id":buyer.id()})).await.unwrap().json().unwrap();
    let credit: u128 = credit.parse().unwrap();
    assert_eq!(credit, NearToken::from_near(1).as_yoctonear() - u128::from(after_deposit - before_tiny) * 10u128.pow(19));
    println!("SIZE_CREDIT deposit {credit}");
    let minimum: String = c.view("storage_minimum_balance").await.unwrap().json().unwrap();
    let minimum: u128 = minimum.parse().unwrap();
    println!("SIZE_STORAGE_CHARGE mint_minimum_yocto {minimum}");
    let purchase_id = "x".repeat(128);
    let msg = json!({"action":"purchase","trader_id":trader.id(),"plan_version":1,"purchase_id":purchase_id}).to_string();
    let o = ft.call(c.id(),"ft_on_transfer").args_json(json!({"sender_id":buyer.id(),"amount":"101","msg":msg})).gas(Gas::from_tgas(100)).transact().await.unwrap();
    record("purchase",&o,Some(100)); assert_eq!(o.json::<String>().unwrap(),"0");
    let after_purchase = c.view_account().await.unwrap().storage_usage;
    let mint_credit: String = c.view("storage_balance_of").args_json(json!({"account_id":buyer.id()})).await.unwrap().json().unwrap();
    let mint_credit: u128 = mint_credit.parse().unwrap();
    assert_eq!(credit - mint_credit, u128::from(after_purchase - after_deposit) * 10u128.pow(19));
    println!("SIZE_STORAGE after_purchase {after_purchase}");
    println!("SIZE_CREDIT mint {mint_credit} charge {}", credit - mint_credit);
    let tid = format!("kf-{}-{}-{}",trader.id(),buyer.id(),purchase_id);
    let msg = json!({"action":"renew","token_id":tid}).to_string();
    let o = ft.call(c.id(),"ft_on_transfer").args_json(json!({"sender_id":buyer.id(),"amount":"101","msg":msg})).gas(Gas::from_tgas(100)).transact().await.unwrap();
    record("renew",&o,Some(100)); assert_eq!(o.json::<String>().unwrap(),"0");
    let after_renew = c.view_account().await.unwrap().storage_usage;
    let renewal_credit: String = c.view("storage_balance_of").args_json(json!({"account_id":buyer.id()})).await.unwrap().json().unwrap();
    let renewal_credit: u128 = renewal_credit.parse().unwrap();
    assert_eq!(mint_credit - renewal_credit, u128::from(after_renew - after_purchase) * 10u128.pow(19));
    println!("SIZE_STORAGE after_renew {after_renew}");
    println!("SIZE_CREDIT renew {renewal_credit} charge {}", mint_credit - renewal_credit);
    // Artificially reduce only this local Sandbox contract's balance to force
    // a native transfer failure; the callback must restore the reservation.
    w.patch(c.id()).account_from_current(|a| near_workspaces::types::AccountDetailsPatch::from(a).balance(NearToken::from_near(6))).transact().await.unwrap();
    let failed = buyer.call(c.id(), "storage_withdraw").args_json(json!({"amount":null})).deposit(NearToken::from_yoctonear(1)).gas(Gas::from_tgas(250)).transact().await.unwrap();
    assert!(!failed.receipt_failures().is_empty(), "native transfer should fail under artificial insolvency");
    let restored: String = c.view("storage_balance_of").args_json(json!({"account_id":buyer.id()})).await.unwrap().json().unwrap();
    assert_eq!(restored.parse::<u128>().unwrap(), renewal_credit);
    w.patch(c.id()).account_from_current(|a| near_workspaces::types::AccountDetailsPatch::from(a).balance(NearToken::from_near(100))).transact().await.unwrap();
    let first = buyer.call(c.id(), "storage_withdraw").args_json(json!({"amount":(renewal_credit / 2).to_string()})).deposit(NearToken::from_yoctonear(1)).gas(Gas::from_tgas(250)).transact().await.unwrap();
    assert!(first.failures().is_empty(), "{:?}", first.failures());
    let out = buyer.call(c.id(), "nft_transfer").args_json(json!({"receiver_id":trader.id(),"token_id":tid,"approval_id":null,"memo":null})).deposit(NearToken::from_yoctonear(1)).gas(Gas::from_tgas(100)).transact().await.unwrap();
    assert!(out.failures().is_empty(), "{:?}", out.failures());
    let second = buyer.call(c.id(), "storage_withdraw").args_json(json!({"amount":null})).deposit(NearToken::from_yoctonear(1)).gas(Gas::from_tgas(250)).transact().await.unwrap();
    assert!(second.failures().is_empty(), "{:?}", second.failures());
    let final_credit: String = c.view("storage_balance_of").args_json(json!({"account_id":buyer.id()})).await.unwrap().json().unwrap();
    assert_eq!(final_credit, "0");
    println!("SIZE_NATIVE payout_failure_restored={restored} success_total={renewal_credit}");
}
