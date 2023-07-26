const { PutRecordCommand, KinesisClient } = require("@aws-sdk/client-kinesis");

const REGION = "us-east-1"; // Update to your region
const client = new KinesisClient({ region: REGION });

exports.lambdaHandler = async (event, context) => {
  let response;

  try {
    const { color, amount } = JSON.parse(event.body);

    console.log("color", color);
    console.log("amount", amount);

    // const data = JSON.stringify({ message: "Hello, world!" });
    const params = {
      Data: Buffer.from(JSON.stringify({ color, amount }), "utf8"),
      PartitionKey: color,
      StreamName: process.env.STREAM_NAME,
    };

    await client.send(new PutRecordCommand(params));

    response = {
      statusCode: 200,
      body: JSON.stringify({
        color,
        amount,
      }),
    };
  } catch (err) {
    console.error(err);
    response = {
      statusCode: 500,
      body: JSON.stringify({
        error: err,
      }),
    };
  }

  return {
    ...response,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  };
};
