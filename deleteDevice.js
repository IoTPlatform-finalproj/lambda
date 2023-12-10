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
  const d_id = event?.pathParameters?.device_id ?? ""
  const u_id = event.requestContext.authorizer.claims.sub

  if (d_id === "") {
    return {
      statusCode: 400,
      headers: header,
      body: {
        "message": "No device id provided!"
      }
    };
  }

  const deleteThingCommand = new DeleteThingCommand({
    thingName: d_id
  })

  const getRuleCommand = new ScanCommand({
    TableName: "IoTPlat_AutoRules",
    FilterExpression: "device_id = :sid",
    ExpressionAttributeValues: {
      ":sid": d_id
    }
  });

  const getStatusLogCommand = new ScanCommand({
    TableName: "IoTPlat_DeviceStatus",
    FilterExpression: "device_id = :sid",
    ExpressionAttributeValues: {
      ":sid": d_id
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
        "device_id": {
          "S" : d_id
        },
        "user_id": {
          "S": u_id
        }
      },
      "TableName": "IoTPlat_Device"
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
          "device_id": {
            "S" : d_id
          },
          "timestamp": {
            "N": item.timestamp
          }
        },
        "TableName": "IoTPlat_DeviceStatus"
      }))
    }
  }


  const listThingPrincipalsCommand = new ListThingPrincipalsCommand({
    thingName: d_id
  });
  try {
    const listThingPrincipals = await iot.send(listThingPrincipalsCommand);
    const detachPromises = listThingPrincipals.principals.map((principal) => {
    const detachThingPrincipalCommand = {
      principal: principal,
      thingName: d_id
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