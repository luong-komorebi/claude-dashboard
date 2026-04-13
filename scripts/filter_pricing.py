#!/usr/bin/env python3
"""
Filter LiteLLM's model_prices_and_context_window.json down to Anthropic
models only, keeping just the cost-per-token fields the dashboard needs.

Usage: filter_pricing.py <input.json> <output.json>
"""
import json
import sys


COST_KEYS = (
    'input_cost_per_token',
    'output_cost_per_token',
    'cache_creation_input_token_cost',
    'cache_read_input_token_cost',
    'input_cost_per_token_above_200k_tokens',
    'output_cost_per_token_above_200k_tokens',
)


def main() -> int:
    if len(sys.argv) != 3:
        print('usage: filter_pricing.py <input> <output>', file=sys.stderr)
        return 1

    with open(sys.argv[1]) as f:
        data = json.load(f)

    out: dict[str, dict[str, float]] = {}
    for name, info in data.items():
        if not isinstance(info, dict):
            continue
        provider = info.get('litellm_provider', '')
        if provider != 'anthropic' and not name.startswith('claude'):
            continue
        kept = {k: info[k] for k in COST_KEYS if k in info}
        if kept:
            out[name] = kept

    with open(sys.argv[2], 'w') as f:
        json.dump(out, f, indent=2, sort_keys=True)

    print(f'wrote {len(out)} models to {sys.argv[2]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
