#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { BookingSystemStack } from '../lib/booking-system-stack';

/**
 * CDK App entry point.
 *
 * `cdk.json` tells the CDK CLI to execute this file. When it runs, CDK
 * builds an in-memory tree of all our constructs and "synthesizes" it
 * into a CloudFormation template (found in cdk.out/ after `cdk synth`).
 */
const app = new App();

new BookingSystemStack(app, 'BookingSystemStack', {
  // `env` controls which AWS account/region the stack deploys to.
  // Leaving it commented means the stack is "environment-agnostic" and
  // will use whatever account/region your CLI is configured with at
  // deploy time. That is perfectly fine for a learning project.
  //
  // env: {
  //   account: process.env.CDK_DEFAULT_ACCOUNT,
  //   region: process.env.CDK_DEFAULT_REGION,
  // },
});
