.PHONY: install setup help

# Default target
help:
	@echo "ClawdOS — Auto-deployment"
	@echo ""
	@echo "Usage:"
	@echo "  make install    Deploy ClawdOS (auto-detect tokens, ports)"
	@echo "  make setup      Alias for 'make install'"
	@echo ""
	@echo "The script auto-detects your Clawdbot tokens from ~/.clawdbot/clawdbot.json"

install:
	@bash scripts/auto-host.sh --systemd --json

setup: install
