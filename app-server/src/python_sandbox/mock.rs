use anyhow::Result;
use async_trait::async_trait;

use crate::python_sandbox::{PythonSandbox, PythonSandboxResult};

pub struct MockPythonSandbox {}

#[async_trait]
impl PythonSandbox for MockPythonSandbox {
    async fn run(&self, _code: &String) -> Result<PythonSandboxResult> {
        Ok(PythonSandboxResult {
            results: vec![],
            stdout: String::from(""),
            stderr: String::from(""),
        })
    }
}
