use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use tonic::{transport::Channel, Request};

use super::sandbox_grpc::{sandbox_client::SandboxClient, RunCodeRequest};
use super::{Sandbox, SandboxRunCodeResult};

pub struct SandboxImpl {
    client: Arc<SandboxClient<Channel>>,
}

impl SandboxImpl {
    pub fn new(client: Arc<SandboxClient<Channel>>) -> Self {
        Self { client }
    }
}

#[async_trait]
impl Sandbox for SandboxImpl {
    async fn run_code(&self, code: &String) -> Result<SandboxRunCodeResult> {
        let mut client = self.client.as_ref().clone();

        let request = Request::new(RunCodeRequest { code: code.clone() });

        let response = client.run_code(request).await?;

        Ok(response.into_inner().into())
    }
}
