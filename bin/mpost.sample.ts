#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { MultipostterStack } from "../lib/multipostter-stack.js";

const app = new cdk.App();
new MultipostterStack(app, "esploMultipostterStack", {
  prefix: "esplo",
  source: "misskey",
});
