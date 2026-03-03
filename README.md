# AgentDesk — Agentic RAG Platform

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose)
[![Qdrant](https://img.shields.io/badge/Qdrant-Vector_DB-DC244C?logo=qdrant&logoColor=white)](https://qdrant.tech)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-ready **Agentic RAG** (Retrieval-Augmented Generation) platform for customer support automation. Built as a reference implementation showcasing how to wire together LLMs, MCP servers, vector stores, and a document pipeline into a cohesive, config-driven system.

---

## Architecture

```
User Request
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Server                        │
│                                                         │
│  ┌──────────────┐    ┌──────────────────────────────┐  │
│  │ Intent Router│───▶│         Agent Loop            │  │
│  │  (TF-IDF)    │    │  ┌────────┐  ┌────────────┐  │  │
│  └──────────────┘    │  │  LLM   │◀▶│ MCP Manager│  │  │
│                      │  │ Client │  │            │  │  │
│  ┌──────────────┐    │  └────────┘  └─────┬──────┘  │  │
│  │Session Mgr   │    └─────────────────────┼────────┘  │
│  └──────────────┘                          │            │
│                                            ▼            │
│  ┌──────────────┐    ┌──────────────────────────────┐  │
│  │Reference     │    │         MCP Servers           │  │
│  │Store (TTL)   │    │  postgres-mcp │ qdrant-mcp   │  │
│  └──────────────┘    │  docling-mcp  │ paddleocr-mcp│  │
└─────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  PostgreSQL  │    │   Qdrant    │    │  vLLM / API │
│  (Customer   │    │  (Vector    │    │  (LLM       │
│   Database)  │    │   Store)    │    │   Backend)  │
└─────────────┘    └─────────────┘    └─────────────┘
```

**Key design decisions:**
- All LLM providers (vLLM, OpenAI, Anthropic, Google, Ollama) accessed via a single OpenAI-compatible client
- MCP servers handle all external I/O — the agent loop stays pure
- Large tool results stored in a TTL reference store to avoid token overflow
- Everything configurable via `config.yaml` — swap providers without touching code

---

## Features

- **Flexible LLM backend** — vLLM (local), OpenAI, Anthropic, Google, Ollama; tiered routing for cost optimization
- **Multi-provider vector store** — Qdrant (default), extensible to Milvus, Chroma, pgvector
- **MCP server management** — stdio and SSE transports, auto-restart, health monitoring
- **Document pipeline** — upload → parse → chunk → embed → store, with configurable chunking strategies
- **Intent routing** — TF-IDF semantic classification, chitchat short-circuits the agent loop
- **Session management** — in-memory conversation history with TTL and message limits
- **Reference store** — large tool results stored by `ref_xxx` code to prevent context overflow
- **Gradio UI** — chat interface, document upload, MCP status, and stats panels
- **Full observability** — structured JSON logs for conversations, token usage, and tool calls

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- (Optional) NVIDIA GPU for local vLLM

### 1. Clone and configure

```bash
git clone https://github.com/your-username/agentdesk.git
cd agentdesk
cp .env.example .env
# Edit .env with your API keys / DB passwords
```

### 2. Start services

```bash
# CPU / cloud LLM mode
docker compose up -d

# GPU mode (includes vLLM)
docker compose --profile gpu up -d
```

### 3. Verify

```bash
curl http://localhost:8000/health
# {"status": "ok"}
```

### 4. Open the UI

Navigate to `http://localhost:7860` for the Gradio interface, or use the REST API directly.

---

## Configuration

All behaviour is controlled by `config.yaml`. Secrets are loaded from `.env` via `${ENV_VAR}` placeholders.

```yaml
llm:
  provider: vllm          # vllm | openai | anthropic | google | ollama
  base_url: http://vllm:8000/v1
  model: Qwen/Qwen3-32B
  tiered:
    enabled: true
    routing_model: Qwen/Qwen3-4B   # cheap model for intent routing
    routing_base_url: http://vllm:8000/v1

vector_store:
  provider: qdrant         # qdrant | milvus | chroma | pgvector
  host: qdrant
  port: 6333
  hybrid_search: true

mcp_servers:
  postgres_mcp:
    enabled: true
    transport: stdio
    command: python
    args: ["-m", "mcp_servers.postgres_mcp"]
```

See [`config.yaml`](config.yaml) for the full reference with all options documented.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/info` | System info (version, active providers) |
| `POST` | `/api/v1/chat` | Synchronous chat |
| `WS` | `/api/v1/chat/stream` | Streaming chat |
| `POST` | `/api/v1/documents` | Upload & process document |
| `GET` | `/api/v1/documents` | List documents |
| `DELETE` | `/api/v1/documents/{id}` | Delete document |
| `GET` | `/api/v1/customers` | Query customer data |
| `GET` | `/api/v1/config` | View config |
| `PUT` | `/api/v1/config` | Update config at runtime |
| `GET` | `/api/v1/mcp/status` | MCP server statuses |
| `GET` | `/api/v1/stats` | Token usage & conversation stats |

Interactive docs available at `http://localhost:8000/docs`.

---

## Project Structure

```
agentdesk/
├── src/
│   ├── agent/          # AgentLoop — iterative LLM ↔ MCP tool-calling loop
│   ├── api/            # FastAPI routers (chat, documents, customers, config, stats)
│   ├── chunking/       # ChunkingEngine (recursive, semantic, document_aware)
│   ├── config/         # ConfigManager + Pydantic models
│   ├── llm/            # LLMClient — unified OpenAI-compatible interface
│   ├── mcp/            # MCPManager — stdio/SSE lifecycle management
│   ├── models/         # API request/response schemas
│   ├── router/         # IntentRouter — TF-IDF semantic classification
│   ├── session/        # SessionManager — conversation history
│   ├── store/          # ReferenceStore — TTL in-memory large data store
│   ├── vectorstore/    # VectorStoreAdapter + QdrantVectorStore
│   ├── logging_config.py
│   └── main.py         # FastAPI app entry point
├── frontend/
│   └── gradio_app.py   # Gradio chat UI
├── db/
│   ├── migrations/     # PostgreSQL schema
│   └── seed/           # Sample data
├── mcp_servers/
│   └── postgres_mcp/   # Read-only PostgreSQL MCP server config
├── tests/
│   ├── unit/           # Component unit tests
│   ├── property/       # Property-based tests (Hypothesis)
│   └── integration/    # End-to-end flow tests
├── config.yaml
├── docker-compose.yml
└── Dockerfile
```

---

## Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run tests
pytest tests/unit -v
pytest tests/integration -v

# Run the server locally (requires Qdrant + PostgreSQL running)
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Run the Gradio UI
python frontend/gradio_app.py
```

---

## Supported Providers

| Category | Options |
|----------|---------|
| LLM | vLLM, OpenAI, Anthropic, Google, Ollama |
| Vector Store | Qdrant (default), extensible to Milvus, Chroma, pgvector |
| Embedding | bge-m3 (local), OpenAI, Voyage, Cohere |
| Document Parser | docling-mcp, paddleocr-mcp (via MCP config) |
| Customer DB | PostgreSQL via postgres-mcp |

---

## License

[MIT](LICENSE)
