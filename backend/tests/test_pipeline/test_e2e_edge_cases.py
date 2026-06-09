import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"

def run_pipeline_on_dataset(file_path: Path):
    """
    Creates a deal, uploads the file, triggers processing, and waits for completion.
    """
    assert file_path.exists(), f"File not found: {file_path}"
    
    # 1. Create a deal
    response = client.post("/api/v1/deals", json={
        "company_name": "Test Target Inc.",
        "deal_name": f"Project Edge Case - {file_path.name}",
        "currency": "USD"
    })
    assert response.status_code == 201
    deal_id = response.json()["deal_id"]
    print(f"\n[+] Created Deal: {deal_id}")

    # 2. Upload file
    with open(file_path, "rb") as f:
        files = {"files": (file_path.name, f, "application/octet-stream")}
        upload_response = client.post(f"/api/v1/deals/{deal_id}/upload", files=files)
        assert upload_response.status_code == 200
    print(f"[+] Uploaded {file_path.name}")

    # 3. Trigger processing
    process_response = client.post(f"/api/v1/deals/{deal_id}/process", json={
        "stages": ["ingestion", "coa_mapping", "financial_builder", "qoe_engine", "redflag_detector"]
    })
    assert process_response.status_code == 200
    print("[+] Triggered Processing Pipeline")

    # 4. Wait for processing to finish
    max_retries = 300  # Wait up to 300 seconds (5 minutes) for LLM agents to finish
    for _ in range(max_retries):
        status_resp = client.get(f"/api/v1/deals/{deal_id}/status")
        assert status_resp.status_code == 200
        deal = status_resp.json()
        stages = deal.get("stages", {})
        
        # Check if all requested stages are complete
        if all(v == "complete" for k, v in stages.items()):
            print("[+] Pipeline completed successfully.")
            return deal
        
        if any(v == "failed" for k, v in stages.items()):
            error = deal.get("error", "Unknown error")
            pytest.fail(f"Pipeline failed: {error}")
            
        time.sleep(1)
        
    pytest.fail("Pipeline timed out")


def test_synthetic_edge_case():
    file_path = FIXTURES_DIR / "synthetic_edge_case.csv"
    deal = run_pipeline_on_dataset(file_path)
    assert deal is not None
    print("Synthetic Edge Case test passed.")
