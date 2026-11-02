import { Collection, Db, Document, MongoClient, ObjectId } from "mongodb";

type MongoClientPromise = Promise<MongoClient>;

export interface ConsultationDocument extends Document {
  _id?: ObjectId;
  consultationId: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  symptoms: string[];
  observations: Array<{
    name: string;
    value: string;
    unit: string;
    recordedAt: Date;
  }>;
  clinicalNotes: {
    complaints: string;
    examination: string;
    assessment: string;
    plan: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

declare global {
  var mongodbClientPromise: MongoClientPromise | undefined;
}

let clientPromise: MongoClientPromise | undefined;

function getMongoConfig(): { uri: string; databaseName: string } {
  const uri = process.env.MONGODB_URI;
  const databaseName = process.env.MONGODB_DB;

  if (!uri || !databaseName) {
    throw new Error(
      "MongoDB configuration is missing. Set MONGODB_URI and MONGODB_DB in the server environment."
    );
  }

  return { uri, databaseName };
}

function getClientPromise(): MongoClientPromise {
  if (process.env.NODE_ENV === "development" && global.mongodbClientPromise) {
    return global.mongodbClientPromise;
  }

  if (clientPromise) {
    return clientPromise;
  }

  const { uri } = getMongoConfig();
  const nextClientPromise = new MongoClient(uri).connect();
  clientPromise = nextClientPromise;

  if (process.env.NODE_ENV === "development") {
    global.mongodbClientPromise = nextClientPromise;
  }

  return nextClientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const { databaseName } = getMongoConfig();
  const client = await getClientPromise();
  return client.db(databaseName);
}

export async function getConsultationsCollection(): Promise<
  Collection<ConsultationDocument>
> {
  const database = await getMongoDb();
  return database.collection("consultations");
}
