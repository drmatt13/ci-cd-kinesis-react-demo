const {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  KinesisClient,
  DescribeStreamCommand,
  GetShardIteratorCommand,
  GetRecordsCommand,
} = require("@aws-sdk/client-kinesis");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" }); // Please update the region as per your setup
const kinesisClient = new KinesisClient({ region: "us-east-1" }); // Please update the region as per your setup

exports.lambdaHandler = async (event) => {
  const streamName = process.env.STREAM_NAME;
  const tableName = process.env.DYNAMO_DB_TABLE;

  try {
    const data = await kinesisClient.send(
      new DescribeStreamCommand({ StreamName: streamName })
    );
    const shards = data.StreamDescription.Shards;

    const records = [];

    for (const shard of shards) {
      const paramsGet = {
        TableName: tableName,
        Key: marshall({ shardId: shard.ShardId }),
      };

      const dynamoData = await dynamoDBClient.send(
        new GetItemCommand(paramsGet)
      );
      let shardIterator;

      if (dynamoData.Item) {
        shardIterator = await kinesisClient.send(
          new GetShardIteratorCommand({
            StreamName: streamName,
            ShardId: shard.ShardId,
            ShardIteratorType: "AFTER_SEQUENCE_NUMBER",
            StartingSequenceNumber: unmarshall(dynamoData.Item).sequenceNumber,
          })
        );
      } else {
        shardIterator = await kinesisClient.send(
          new GetShardIteratorCommand({
            StreamName: streamName,
            ShardId: shard.ShardId,
            ShardIteratorType: "TRIM_HORIZON",
          })
        );
      }

      const recordsData = await kinesisClient.send(
        new GetRecordsCommand({
          ShardIterator: shardIterator.ShardIterator,
        })
      );

      records.push(...recordsData.Records);

      if (recordsData.Records.length > 0) {
        const lastRecord = recordsData.Records[recordsData.Records.length - 1];

        const paramsPut = {
          TableName: tableName,
          Item: marshall({
            shardId: shard.ShardId,
            sequenceNumber: lastRecord.SequenceNumber,
          }),
        };

        await dynamoDBClient.send(new PutItemCommand(paramsPut));
      }
    }

    const results = records
      .map((record) => {
        try {
          // Convert the data object back into an array of ASCII codes
          const asciiCodes = Object.values(record.Data);

          // Convert the array of ASCII codes back into a UTF-8 string
          const dataAsString = String.fromCharCode.apply(null, asciiCodes);

          // return jsonObject;
          return JSON.parse(dataAsString);
        } catch (err) {
          console.error(`Failed to parse record data: ${err}`);
          return null;
        }
      })
      .filter((result) => result !== null);
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // this line enables CORS
        "Access-Control-Allow-Credentials": true,
      },
      body: results,
      body: JSON.stringify(results),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*", // this line enables CORS
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        error,
      }),
    };
  }
};
