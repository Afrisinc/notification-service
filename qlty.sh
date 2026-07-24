#!/bin/sh
set -e
npx lint-staged
pnpm type-check
pnpm build
