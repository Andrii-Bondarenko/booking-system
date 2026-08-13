import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * StorageConstruct — the two S3 buckets.
 *
 * - Imports bucket: admins upload mentor CSVs (mentors-import/...). The
 *   compute layer wires an S3 event trigger on this bucket.
 * - Exports bucket: the export Lambda writes generated CSVs here.
 *
 * Shared bucket settings: block ALL public access, encrypt at rest, and
 * auto-delete on `cdk destroy`. Both auto-expire objects after 30 days
 * since import/export files are temporary.
 */
export class StorageConstruct extends Construct {
  public readonly importsBucket: Bucket;
  public readonly exportsBucket: Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const commonBucketProps = {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: Duration.days(30) }],
    };

    this.importsBucket = new Bucket(this, 'ImportsBucket', { ...commonBucketProps });
    this.exportsBucket = new Bucket(this, 'ExportsBucket', { ...commonBucketProps });
  }
}
