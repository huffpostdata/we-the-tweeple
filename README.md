## Developing

1. Install NodeJS >= 6.7.0 from https://nodejs.org/en/
2. Install `libjpeg-turbo-devel`, `cairo-devel` and `yasm`
3. `npm install`
4. `node generator/dev.js`

Then browse to http://localhost:3000

### Updating our Google Docs

If you're adding/removing docs, look to `config/google-docs.yml`.

Then run `npm run update-google-docs` to download newer data from Google Docs.

You'll have to commit the newly-downloaded JSON to this repository to publish
it.

### Deploying

We'll automate this. But for now, here's how we deployed to production:

1. (Once per project) SSH into a server and:
  1. `git init --bare SLUG.git`
  2. Copy this file to `~/SLUG.git/hooks/post-receive`:
```
#!/bin/sh

read OLDREV NEWREV REFNAME

set -ex

[ "$REFNAME" = 'refs/heads/master' ] || exit 0

ROOT=/tmp/deploy-SLUG

rm -rf "$ROOT/code"
mkdir -p "$ROOT/code"
git archive --format=tar HEAD | (cd "$ROOT/code" && tar xf -)

mkdir -p "$ROOT/shared/node_modules" # if it doesn't already exist
ln -sf "$ROOT/shared/node_modules" "$ROOT/code/node_modules"

pushd "$ROOT/code"

npm install --production
S3_BUCKET=data.huffingtonpost.com \
  BASE_URL='http://data.huffingtonpost.com' \
  node generator/upload.js

popd
```
  3. `chmod +x ~/SLUG.git/hooks/post-receive`
2. (Once per dev machine per project) Run `git remote add production ssh://rails@production-elections-utility-01.use1.huffpo.net/home/rails/SLUG.git`
3. (Once per deploy) `git push production master`. You'll see the output in your console.

