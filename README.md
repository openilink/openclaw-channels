# openclaw-channel-openilink

[OpenClaw](https://github.com/openclaw/openclaw) channel plugin for WeChat messaging via [OpenILink](https://openilink.com) Hub.

## Features

- Receive WeChat messages in OpenClaw via OpenILink Hub
- Send replies back through WeChat
- WebSocket real-time message delivery with automatic reconnection
- Message deduplication
- Configurable DM policy (pairing / allowlist / open)

## Requirements

- OpenClaw >= 2026.2.13
- An OpenILink Hub instance with a bound WeChat bot
- A channel API key from the Hub dashboard

## Installation

```bash
openclaw plugins install @openilink/openclaw-channel
```

Add the plugin to your allow list in `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "allow": ["@openilink/openclaw-channel"]
  }
}
```

## Configuration

Run the interactive setup:

```bash
openclaw configure --section channels
```

Or manually edit `~/.openclaw/openclaw.json`:

```json
{
  "channels.openilink": {
    "hubUrl": "https://your-hub.example.com",
    "apiKey": "your-channel-api-key",
    "enabled": true,
    "dmPolicy": "pairing"
  }
}
```

Then restart the gateway:

```bash
openclaw gateway restart
```

## Configuration Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `hubUrl` | Yes | — | OpenILink Hub URL |
| `apiKey` | Yes | — | Channel API key from Hub dashboard |
| `botId` | No | auto | Bot ID (auto-detected from channel) |
| `enabled` | No | `true` | Enable/disable the account |
| `dmPolicy` | No | `pairing` | DM access policy: `pairing`, `allowlist`, or `open` |
| `allowFrom` | No | `[]` | Allowed sender IDs (for `allowlist` policy) |

## Architecture

```
OpenClaw Gateway
    ↕ (plugin-sdk)
openclaw-channel-openilink
    ↕ (WebSocket + REST API)
OpenILink Hub
    ↕ (iLink SDK)
WeChat
```

## License

MIT
