use anyhow::Result;
use async_trait::async_trait;

use crate::sandbox::{Sandbox, SandboxRunCodeResult};

pub struct MockSandbox {}

#[async_trait]
impl Sandbox for MockSandbox {
    async fn run_code(&self, _code: &String) -> Result<SandboxRunCodeResult> {
        Ok(SandboxRunCodeResult {
            results: vec![],
            stdout: String::from(""),
            stderr: String::from(""),
        })
    }
}
