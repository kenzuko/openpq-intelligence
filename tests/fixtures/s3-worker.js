import {S3ReadonlyReader} from '../../src/platform/s3-reader.js';
export default {async fetch(){
  const config={endpoint:'https://test-account.r2.cloudflarestorage.com',bucket:'isolated-test',access_key:'fixture',secret:'synthetic-fixture-secret'};
  try{return new Response(await new S3ReadonlyReader(config).get('canonical/object.json'));}
  catch(error){return Response.json({name:error.name,message:error.message},{status:500});}
}};
