use anyhow::Result;
use async_trait::async_trait;
use serde::Serialize;
pub mod mock;
pub mod sandbox_grpc;
pub mod sandbox_impl;

#[derive(Serialize)]
pub struct RunResult {
    pub text: String,
    // base64 encoded image
    pub image: Option<String>,
}

#[derive(Serialize)]
pub struct SandboxRunCodeResult {
    pub results: Vec<RunResult>,
    pub stdout: String,
    pub stderr: String,
}

impl From<sandbox_grpc::Result> for RunResult {
    fn from(result: sandbox_grpc::Result) -> Self {
        Self {
            text: result.text,
            image: result.image,
        }
    }
}

impl From<sandbox_grpc::RunCodeResponse> for SandboxRunCodeResult {
    fn from(response: sandbox_grpc::RunCodeResponse) -> Self {
        Self {
            results: response.results.into_iter().map(|r| r.into()).collect(),
            stdout: response.stdout,
            stderr: response.stderr,
        }
    }
}

#[async_trait]
pub trait Sandbox: Sync + Send {
    async fn run_code(&self, code: &String) -> Result<SandboxRunCodeResult>;
}
