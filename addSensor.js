import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { IoTClient, CreateThingCommand, CreateKeysAndCertificateCommand, AttachThingPrincipalCommand, AttachPolicyCommand, UpdateCertificateCommand } from "@aws-sdk/client-iot";


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
  'Access-Control-Allow-Methods': 'OPTIONS,PUT,GET',
  'Content-Type': 'application/json'
}

export const handler = async (event) => {

    const req_body = JSON.parse(event.body)
  
  const u_id = event.requestContext.authorizer.claims.sub

  
  const s_id = "ss_"+generateUUID()
  const s_type = req_body['sensor_type']
  const s_name = req_body['sensor_name']
  const s_desc = req_body['sensor_description']
  
  try {
    // 새로운 사물 생성
    const createThingCommand = new CreateThingCommand({
      thingName: s_id
    });

    const createThingResponse = await iot.send(createThingCommand);

    // 새로운 인증서 및 키 생성
    const createKeysCommand = new CreateKeysAndCertificateCommand({});
    const createKeysResponse = await iot.send(createKeysCommand);

    const certificateArn = createKeysResponse.certificateArn;
    const certificatePem = createKeysResponse.certificatePem;
    const privateKey = createKeysResponse.keyPair.PrivateKey;
    const publicKey = createKeysResponse.keyPair.PublicKey;
    const certificateId = createKeysResponse.certificateId;

    await iot.send(new AttachThingPrincipalCommand({
      thingName: s_id,
      principal: certificateArn
    }));
    
    const policyArn = 'arn:aws:iot:us-east-1:369147590111:policy/AllowEverything'; // 정책의 ARN
    await iot.send(new AttachPolicyCommand({
      policyName: 'AllowEverything', // 연결할 정책의 이름
      target: certificateArn
    }));
    
    await iot.send(new UpdateCertificateCommand({
      certificateId: certificateId,
      newStatus: 'ACTIVE'
    }));

    const command = new PutCommand({
      TableName: 'IoTPlat_Sensor',
      Item: {
          'sensor_id': s_id,
          'user_id': event.requestContext.authorizer.claims.sub,
          'sensor_name': s_name,
          'sensor_type': s_type,
          'sensor_description': s_desc
      }
  });
    const dbResponse = await docClient.send(command);

    return {
      statusCode: 200,
      headers: header,
      body: JSON.stringify({
        sensor_id:s_id,
        certificateArn,
        certificatePem,
        privateKey,
        publicKey
      })
    };
  }
  catch(error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: header,
      body: JSON.stringify({ message: 'Internal Server Error(IOT)' })
    };
  }
  
  
};

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}