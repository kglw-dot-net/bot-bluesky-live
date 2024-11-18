# [bot-bluesky-live](https://bsky.app/profile/gizz-live.bsky.social)

⚠️ 🚧 🪚 **Work In Progress** 🦺 🛠️ 🗜️

A [Bluesky] bot — whenever King Gizzard plays a song on stage, this bot will post the song name!

Brought to you by the [KGLW.net] Tech & Live-Coverage Teams


## TODO

* [ ] "start time" post
    * [ ] "doors time" post?
* [ ] songs are replies to previous song
* [ ] robustly check whether the show is currently-active (i.e. we're not editing an old show / accidentally modifying an upcoming show)
* [ ] idempotency check before posting? (mastodon has this)


## Docs

* [NPM package: `@proto/api`](https://github.com/bluesky-social/atproto/blob/main/packages/api/README.md)


## Ops

Run on AWS Lambda.

1. Create new Lambda Function...
  * pick a name like "kglwBotBlueskyLive"
  * using Node.js (v20.x at time of writing)
  * check-on "Enable function URL" ("Use function URLs to assign HTTP(S) endpoints to your Lambda function") ... once you've created this function, the "function URL" will be something like `https://HASH_HERE.lambda-url.us-west-1.on.aws/`
  * Auth type: `NONE` — "Lambda won't perform IAM authentication on requests to your function URL. The URL endpoint will be public unless you implement your own authorization logic in your function"
    * TODO this is an area for improvement...
  * other options left to default…
    * arch: x86_64
    * execution role: "Create a new role with basic Lambda permissions" ("Lambda will create an execution role … with permission to upload logs to Amazon CloudWatch Logs")
    * Invoke mode: BUFFERED
2. set env vars so the Lambda Function sees 'em...


[Bluesky]: https://bsky.social
[KGLW.net]: https://kglw.net
