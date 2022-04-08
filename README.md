# Blocktank Tightrope

Automatically rebalance channels within a cluster of lightning nodes

## ⚠️ Warning

This is pre-alpha software. Please use at your own risk. Expect breaking changes on minor releases.

## Usage

Before you start, copy `config/default.json` to `config/local.json` and edit the copy.

* secret - this is the shared secret that the cluster will use. Pick a long and complex password
* balance.deadzone - how far away from in-balance can a channel get before tightrope will attempt to rebalance the channel. The default is 0.1 (10%)
* refreshRateSeconds - the time (in seconds) between each check of the existing channels. At this interval, tightrope will check channels that connect other lightning nodes in the cluster and if any are out of balance, it will initiate the process of rebalancing the channel.
* lightningNodes - an array of lightning nodes to manage. For each node you will need to provide the following...
    * base64 encoded TLS Certificate
    * base64 encoded macaroon that has enough permissions to query channels, create and pay invoices
    * the GRPC Host of the lightning node
* audit - various settings about where to store the event and transactions logs (both HyperCores) and if verbose logging to the terminal is also required

Once you config is set up, just...

```
node src
```

## How it works...

