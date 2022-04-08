# Blocktank - Tightrope

Tightrope can automatically rebalance channels within a cluster of Lightning Network nodes using distributed peer-to-peer communication over [Hyperswarm](https://github.com/hyperswarm/hyperswarm).

## ⚠️ Warning

This is pre-alpha software. Please use at your own risk. Expect breaking changes on minor releases.

## Usage

Before you start, copy `config/default.json` to `config/local.json` and edit the copy.

* secret - this is the shared secret that the cluster will use. Pick a long and complex password
* balance.deadzone - how far away from in-balance can a channel get before Tightrope will attempt to rebalance the channel. The default is 0.1 (10%)
* refreshRateSeconds - the time (in seconds) between each check of the existing channels. At this interval, Tightrope will check channels that connect other lightning nodes in the cluster and if any are out of balance, it will initiate the process of rebalancing the channel.
* lightningNodes - an array of lightning nodes to manage. For each node you will need to provide the following...
    * base64 encoded TLS Certificate
    * base64 encoded macaroon that has enough permissions to query channels, create and pay invoices
    * the GRPC Host of the lightning node
* audit - various settings about where to store the event and transactions logs (both Hypercores) and if verbose logging to the terminal is also required

Once you config is set up, just...

```
node src
```

## What does Tightrope do?

Each instance of Tightrope can be given API credentials of many Lightning nodes. Tightrope will find all the channels between these Lightning nodes and keep an eye on them. When they drift too far out of balance, Tightrope will ask the poorer side of the channel to generate an invoice to bring it back into balance. Tightrope will then pass this invoice to the richer side of the channel, asking for it to be paid. When paid, the channel is back in balance.

If parts of your cluster of Lightning nodes are managed by someone else, it might not be desirable for one party to provide the other with the API credentials for their set of Lightning nodes. Tightrope also solves this issue! Each party runs their own instance of Tightrope, with just their Lightning node credentials included. They share a secret that allows Tightrope to find the rest of the cluster of Lightning nodes using Hyperswarm, so channels that connect the two groups can also be kept in balance securely without either side needing to share API credentials with the other. 

Example:

Alice has 2 lightning nodes (A and B). Each has many open channels, including 1 important channel between A and B that Alice wants to keep in balance to maintain liquidity between A and B. Alice sets up Tightrope, and adds the API credentials for A and B into the config. She also sets the secret in her Tightrope config to "correcthorsebatterystaple". She starts Tightrope and it will automatically find the channel between A and B and keeps it in constant balance.

Bob also runs a cluster of Lightning nodes (C, D and E). He also needs to maintain liquidity between his nodes and uses Tightrope to do this. His config contains details of all three of this nodes along with his own secret password.

Alice and Bob agree that they would both benefit from a high capacity channel that links them (from A to C) and create it. Bob updates the secret in his Tightrope config to "correcthorsebatterystaple" and restarts Tightrope. Both clusters are now able to find each other and the channel between A and C is also kept in balance.

Later Bob opens a new channel between E and B. Tightrope automatically detects this change and will start maintaining this channel as well, without even needing to be restarted.

## How it works...

Tightrope first connects to all the Lightning nodes listed in the config file. For each node it starts a hyperswarm, following a topic derived from the secret in the config. This ensure that all other nodes in the cluster can find each other, and are able to talk securely over a peer-to-peer noise connection with each other. 

Using the mechanism, Tightrope determines if any of the channels on a given node are actually channels to one of the other nodes in the cluster. If they are, it starts watching them. Whenever the channel is out of balance, an invoice is generated and sent to the peer that manages the Lightning node on the other side of the channel. Once validated, the invoice is paid, bringing the channel back into balance.
