use std::{collections::HashMap, sync::Arc};

use crate::engine::{RunOutput, RunnableNode};
use crate::pipeline::context::Context;
use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::utils::map_handles;
use super::{Handle, HandleType, NodeInput};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeNode {
    pub id: Uuid,
    pub name: String,
    pub inputs: Vec<Handle>,
    pub outputs: Vec<Handle>,
    /// to -> from
    pub inputs_mappings: HashMap<Uuid, Uuid>,
    pub code: String,
}

#[async_trait]
impl RunnableNode for CodeNode {
    fn handles_mapping(&self) -> Vec<(Uuid, Handle)> {
        map_handles(&self.inputs, &self.inputs_mappings)
    }

    fn output_handle_id(&self) -> Uuid {
        self.outputs.first().unwrap().id
    }

    fn node_name(&self) -> String {
        self.name.to_owned()
    }

    fn node_id(&self) -> Uuid {
        self.id
    }

    fn node_type(&self) -> String {
        "Code".to_string()
    }

    async fn run(
        &self,
        inputs: HashMap<String, NodeInput>,
        context: Arc<Context>,
    ) -> Result<RunOutput> {
        let output_handle = self.outputs.first();
        if output_handle.is_none() {
            return Err(anyhow::anyhow!("No output handle found"));
        }

        let code = self.code.clone();

        // injecting main function call with kwargs from inputs at the end of the code
        let code = format!(
            "{code}\n\nmain({})",
            inputs
                .into_iter()
                .map(|(k, v)| {
                    let value: String = v.into();
                    format!("{k}={value}", k = k, value = value)
                })
                .collect::<Vec<String>>()
                .join(", ")
        );

        let run_result = context.python_sandbox.run(&code).await?;

        match run_result.results.first() {
            Some(result) => Ok(RunOutput::Success((result.text.clone().into(), None))),
            None => Err(anyhow::anyhow!(run_result.stderr)),
        }
    }
}

impl CodeNode {
    pub fn from_params(name: &str, input_names: Vec<&str>, code: String) -> Self {
        let inputs = input_names
            .iter()
            .map(|name| Handle {
                id: Uuid::new_v4(),
                name: Some(name.to_string()),
                handle_type: HandleType::Any,
                is_cyclic: false,
            })
            .collect();
        let outputs = vec![Handle {
            id: Uuid::new_v4(),
            name: Some("output".to_owned()),
            handle_type: HandleType::Any,
            is_cyclic: false,
        }];

        Self {
            id: Uuid::new_v4(),
            name: name.to_string(),
            inputs,
            outputs,
            inputs_mappings: HashMap::new(),
            code,
        }
    }
}
