from concurrent import futures

import logging
import grpc
from sandbox_pb2_grpc import (
    add_SandboxServicer_to_server,
    SandboxServicer,
)
from sandbox_pb2 import (
    RunCodeResponse,
    Result,
    HealthcheckResponse,
)
import jupyter_client
import json

PORT = 8812

LOGGER = logging.getLogger("python_sandbox")
console_log_handler = logging.StreamHandler()
console_log_handler.setLevel(logging.DEBUG)
LOGGER.addHandler(console_log_handler)
LOGGER.setLevel(logging.DEBUG)
logging.basicConfig()


class SandboxServicer(SandboxServicer):
    def __init__(self):
        self.kernel_manager = jupyter_client.KernelManager()
        self.kernel_manager.start_kernel()
        self.kernel_client = self.kernel_manager.client()

    def __del__(self):
        # Cleanup kernel resources
        if hasattr(self, 'kernel_client'):
            self.kernel_client.stop_channels()
        if hasattr(self, 'kernel_manager'):
            self.kernel_manager.shutdown_kernel()

    def RunCode(self, request, context):

        self.kernel_client.execute(request.code)
        results = []

        stdout = ""
        stderr = ""

        while True:
            msg = self.kernel_client.get_iopub_msg(timeout=10)
            if msg['header']['msg_type'] == 'execute_result':
                results.append(msg['content']['data'])
            elif msg['header']['msg_type'] == 'error':
                stderr += msg['content']['traceback'][0]
            elif msg['header']['msg_type'] == 'display_data':
                # Capture Matplotlib or base64 figures
                results.append(msg['content']['data'])
            elif msg['header']['msg_type'] == 'stream':
                # Capture stdout/stderr
                if msg['content']['name'] == 'stdout':
                    stdout += msg['content']['text']
                elif msg['content']['name'] == 'stderr':
                    stderr += msg['content']['text']
            elif msg['header']['msg_type'] == 'status' and msg['content']['execution_state'] == 'idle':
                break

        results = [
            Result(text=str(result["text/plain"]), image=result.get("image/png"))
            for result in results
        ]

        return RunCodeResponse(results=results, stdout=stdout, stderr=stderr)

    def Healthcheck(self, request, context):
        return HealthcheckResponse()


def serve():
    servicer = SandboxServicer()
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=8))
    add_SandboxServicer_to_server(servicer, server)
    server.add_insecure_port(f"[::]:{PORT}")
    server.start()

    LOGGER.info(f"Python sandbox server started and ready on port {PORT}")

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        LOGGER.info("Shutting down server...")
        server.stop(0)
        servicer.__del__()  # Explicitly cleanup kernel


if __name__ == "__main__":
    serve()
