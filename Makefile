PYTHON ?= python

.DEFAULT_GOAL := help
.PHONY: help install run test lint build clean

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install backend (incl. test/lint tools) and frontend dependencies
	$(PYTHON) -m pip install -r backend/requirements-dev.txt
	cd frontend && npm ci --no-audit --no-fund

run: ## Start backend (:8000) and frontend (:5173) together
	$(PYTHON) run.py

test: ## Run the backend test suite
	$(PYTHON) -m pytest backend -q

lint: ## Ruff on the Python code, tsc --noEmit on the frontend
	$(PYTHON) -m ruff check .
	cd frontend && npm run typecheck

build: ## Production build of the frontend into frontend/dist
	cd frontend && npm run build

clean: ## Remove caches and build output
	rm -rf .pytest_cache .ruff_cache backend/.pytest_cache frontend/dist
	find . -name __pycache__ -type d -not -path './node_modules/*' -not -path './.venv/*' -prune -exec rm -rf {} +
