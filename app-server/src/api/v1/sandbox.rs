use crate::{routes::types::ResponseResult, sandbox};
use actix_web::{post, web, HttpResponse};
use sandbox::Sandbox;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Deserialize)]
struct RunCodeRequest {
    code: String,
}

#[post("sandbox/code/run")]
async fn run_code(
    sandbox: web::Data<Arc<dyn Sandbox>>,
    params: web::Json<RunCodeRequest>,
) -> ResponseResult {
    let sandbox = sandbox.into_inner();
    let code = params.into_inner().code;
    let result = sandbox.run_code(&code).await?;
    Ok(HttpResponse::Ok().json(result))
}
