import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import path from "path";
import { fileURLToPath } from "url";

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

interface Props extends cdk.StackProps {
  prefix: string;
  source: "misskey" | "mastodon";
}

export class MultipostterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const table = new cdk.aws_dynamodb.Table(
      this,
      `${props.prefix}LastIDTable`,
      {
        partitionKey: {
          name: "sourceSNS",
          type: cdk.aws_dynamodb.AttributeType.STRING,
        },
        billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      }
    );

    const params = new cdk.aws_ssm.StringParameter(
      this,
      `${props.prefix}secrets`,
      {
        parameterName: `/multipostter/${props.prefix}/secrets`,
        stringValue: `{
  "BSKY_ID": "string",
  "BSKY_APP_PASS": "string",
  "MISSKEY_USER_ID": "string",
  "MASTODON_USER_ID": "string",
  "MASTODON_ACCESS_TOKEN": "string",
  "TWITTER_API_KEY": "string",
  "TWITTER_API_SECRET": "string",
  "TWITTER_ACCESS_TOKEN": "string",
  "TWITTER_ACCESS_TOKEN_SECRET": "string"
}`,
        tier: cdk.aws_ssm.ParameterTier.STANDARD,
      }
    );

    const fn = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      `${props.prefix}multiPostFn`,
      {
        reservedConcurrentExecutions: 1,
        entry: path.join(__dirname, "../lambda/index.ts"),
        architecture: cdk.aws_lambda.Architecture.ARM_64, // change if your system is x86_64
        environment: {
          DDB_TABLE_NAME: table.tableName,
          PARAMSTORE_NAME: params.parameterName,
          SOURCE: props.source,
        },
        bundling: {
          format: cdk.aws_lambda_nodejs.OutputFormat.ESM,
          mainFields: ["module", "main"],
          minify: true,
          sourceMap: true,
          // platform: "linux/arm64", // change if your system is x86_64
          // // https://github.com/aws/aws-cdk/issues/29310
          banner:
            "const require = (await import('node:module')).createRequire(import.meta.url);const __filename = (await import('node:url')).fileURLToPath(import.meta.url);const __dirname = (await import('node:path')).dirname(__filename);",
          forceDockerBundling: true,
          nodeModules: ["sharp"],
        },
        memorySize: 2048,
        runtime: cdk.aws_lambda.Runtime.NODEJS_LATEST,
        timeout: cdk.Duration.seconds(60), // if there are many posts, retry again
      }
    );

    table.grantReadWriteData(fn);
    params.grantRead(fn);

    new cdk.aws_events.Rule(this, `${props.prefix}RepeatRule`, {
      schedule: cdk.aws_events.Schedule.rate(cdk.Duration.minutes(10)),
      targets: [new cdk.aws_events_targets.LambdaFunction(fn)],
      enabled: true,
    });
  }
}
