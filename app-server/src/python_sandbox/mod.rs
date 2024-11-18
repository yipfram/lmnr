use anyhow::Result;
use async_trait::async_trait;
pub mod mock;
pub mod python_sandbox_grpc;
pub mod python_sandbox_impl;

pub struct RunResult {
    pub text: String,
    // base64 encoded image
    pub image: Option<String>,
}

pub struct PythonSandboxResult {
    pub results: Vec<RunResult>,
    pub stdout: String,
    pub stderr: String,
}

impl From<python_sandbox_grpc::Result> for RunResult {
    fn from(result: python_sandbox_grpc::Result) -> Self {
        Self {
            text: result.text,
            image: result.image,
        }
    }
}

impl From<python_sandbox_grpc::RunResponse> for PythonSandboxResult {
    fn from(response: python_sandbox_grpc::RunResponse) -> Self {
        Self {
            results: response.results.into_iter().map(|r| r.into()).collect(),
            stdout: response.stdout,
            stderr: response.stderr,
        }
    }
}

#[async_trait]
pub trait PythonSandbox: Sync + Send {
    async fn run(&self, code: &String) -> Result<PythonSandboxResult>;
}
