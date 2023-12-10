import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { IoTClient, DetachThingPrincipalCommand, DeleteThingCommand, ListThingPrincipalsCommand } from "@aws-sdk/client-iot";


const iot = new IoTClient({ region: 'us-east-1' });

const client = new DynamoDBClient({});

const marshallOptions = {
  convertEmptyValues: false,
  removeUndefinedValues: true,
  convertClassInstanceToMap: false
};

const unmarshallOptions = {
  wrapNumbers: false
};

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions,
  unmarshallOptions
});

const header = {
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS,DELETE',
  'Content-Type': 'application/json'
};

export const handler = async (event) => {
  const s_id = event?.pathParameters?.sensor_id ?? ""
  const u_id = event.requestContext.authorizer.claims.sub

  if (s_id === "") {
    return {
      statusCode: 400,
      headers: header,
      body: {
        "message": "No sensor id provided!"
      }
    };
  }

  const deleteThingCommand = new DeleteThingCommand({
    thingName: s_id
  })

  const getRuleCommand = new ScanCommand({
    TableName: "IoTPlat_AutoRules",
    FilterExpression: "sensor_id = :sid",
    ExpressionAttributeValues: {
      ":sid": s_id
    }
  });

  const getStatusLogCommand = new ScanCommand({
    TableName: "IoTPlat_SensorStatus",
    FilterExpression: "sensor_id = :sid",
    ExpressionAttributeValues: {
      ":sid": s_id
    }
  });

  let getStatusLogResult = null
  let getRuleResult = null;
    
  try {
    getRuleResult = await docClient.send(getRuleCommand);
    getStatusLogResult = await docClient.send(getStatusLogCommand)
  }
  catch (e) {
    console.log(e)
  }

  const deleteDBCommands = [
    new DeleteItemCommand({
      "Key": {
        "sensor_id": {
          "S" : s_id
        },
        "user_id": {
          "S": u_id
        }
      },
      "TableName": "IoTPlat_Sensor"
    })
  ]


  if (getRuleResult !== null) {
    for (const item of getRuleResult.Items) {
        const command = new DeleteItemCommand({
            "Key": {
              "user_id": {
                "S": u_id
              },
              "rule_id": {
                "S": item.rule_id
              }
            },
            "TableName": "IoTPlat_AutoRules"
        })
        deleteDBCommands.push(command)
      
    }
  }

  if (getStatusLogResult!== null) {
    for (const item of getStatusLogResult.Items) {
      deleteDBCommands.push(new DeleteItemCommand({
        "Key": {
          "sensor_id": {
            "S" : s_id
          },
          "timestamp": {
            "N": item.timestamp
          }
        },
        "TableName": "IoTPlat_SensorStatus"
      }))
    }
  }


  const listThingPrincipalsCommand = new ListThingPrincipalsCommand({
    thingName: s_id
  });
  try {
    const listThingPrincipals = await iot.send(listThingPrincipalsCommand);
    const detachPromises = listThingPrincipals.principals.map((principal) => {
    const detachThingPrincipalCommand = {
      principal: principal,
      thingName: s_id
    };
      return iot.send(new DetachThingPrincipalCommand(detachThingPrincipalCommand));
    })
    await Promise.all(detachPromises)
    await iot.send(deleteThingCommand)
  }
    catch (error) {
      console.log(error)
  }

  Promise.all(
    ...(deleteDBCommands.map((command) => {
      return client.send(command)
    }))
  ).then((values) => {
    return {
      statusCode: 200,
      headers: header,
      body: JSON.stringify(values)
    }
  }).catch((error) => {
    return {
      statusCode: 500,
      headers: header,
      body: JSON.stringify(error)
    }
  })

  return {
    statusCode: 200,
    headers: header,
  }
}