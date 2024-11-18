use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use tonic::{transport::Channel, Request};

use super::python_sandbox_grpc::{python_sandbox_client::PythonSandboxClient, RunRequest};
use super::{PythonSandbox, PythonSandboxResult};

pub struct PythonSandboxImpl {
    client: Arc<PythonSandboxClient<Channel>>,
}

impl PythonSandboxImpl {
    pub fn new(client: Arc<PythonSandboxClient<Channel>>) -> Self {
        Self { client }
    }
}

#[async_trait]
impl PythonSandbox for PythonSandboxImpl {
    async fn run(&self, code: &String) -> Result<PythonSandboxResult> {
        let mut client = self.client.as_ref().clone();

        let request = Request::new(RunRequest { code: code.clone() });

        let response = client.run(request).await?;

        Ok(response.into_inner().into())
    }
}
