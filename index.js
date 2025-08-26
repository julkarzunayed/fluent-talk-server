const express = require('express');
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//for Firebase Admin
const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decoded);


const app = express();
const port = process.env.PORT || 3000;


//middlewares
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "https://fluent-talk-auth.web.app",
            "https://fluent-talk-auth.firebaseapp.com"
        ]
    })
);
app.use(express.json());

//firebase middleWare
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


const verifyFirebaseToken = async (req, res, next) => {
    const authToken = req?.headers?.authorization;
    const token = authToken?.split('Bearer ')[1];


    if (!authToken || !authToken?.startsWith('Bearer')) {
        return res.status(401).send({ massage: 'unauthorized access' });
    };

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded = decoded;
        next();
    }
    catch (error) {
        return res.status(403).send({ massage: 'invalid access token' });
    }

}

const verifyEmail = async (req, res, next) => {
    if (req.query.email !== req.decoded.email) {
        return res.status(403).send({ massage: 'unauthorized access' })
    }
    next()
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vpoctao.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const usersCollections = client.db('fluent_talk').collection('users');
        const tutorialsCollections = client.db('fluent_talk').collection('tutorials');
        const tutorialBookingCollections = client.db('fluent_talk').collection('tutorialBookings');

        //

        // app.post('/api/signOut', async (req, res) => {
        //     const uid = req.body.uid;
        //     console.log('sign Out ____')
        //     if (!uid) {
        //         return res.status(400).send('user IS is required.');
        //     };
        //     try {
        //         await admin.auth().revokeRefreshTokens(uid);

        //         const userRecord = await admin.auth().getUser(uid);
        //         const revocationTime = new Date(userRecord.tokensValidAfterTimestamp);
        //         console.log(`Successfully revoked refresh tokens for user ${uid}.`);
        //         console.log(`Tokens valid after: ${revocationTime.toISOString()}`);

        //         res.status(200).json({ success: true, message: 'User session revoked successfully.' });
        //     }
        //     catch (error) {
        //         console.log(error)
        //     }
        // })

        //users APIs
        app.post('/user', async (req, res) => {
            const userInfo = req.body;
            const isUserExist = await usersCollections.findOne({ email: userInfo.email })
            if (isUserExist) {
                return res.status(200).json({
                    massage: 'user already exist and logged in successfully',
                })
            } else {
                const result = await usersCollections.insertOne(userInfo);
                res.send(result)
            }

        });

        app.get('/user', async (req, res) => {
            const userEmail = req.query.email;
            const query = {
                email: userEmail,
            };
            const result = await usersCollections.findOne(query);
            res.send(result);
        });

        app.patch('/user', verifyFirebaseToken, verifyEmail, async (req, res) => {
            const userEmail = req.query.email;
            const query = {
                email: userEmail,
            };
            const updateDoc = req.body;
            const update = {
                $set: updateDoc,
            }
            const result = await usersCollections.updateOne(query, update);
            res.send(result);
        })

        app.get('/user/:role', async (req, res) => {
            const role = req.params.role;
            const result = await usersCollections.countDocuments({ role: role })
            res.send(result);
        });

        // tutorial Related APIs 

        app.get('/tutorial', async (req, res) => {
            const { tutorial_id, search, tutorName } = req?.query;
            const query = {};
            // console.log(tutorName)
            if (tutorial_id) {
                query._id = new ObjectId(tutorial_id)
            }
            if (search) {
                query.language = {
                    $regex: search, $options: 'i',
                };
            }
            if (tutorName) {
                query.tutorName = {
                    $regex: tutorName, $options: 'i'
                }
            }
            const result = await tutorialsCollections.find(query).toArray();
            res.send(result);
        });

        app.get('/tutorial/byTutorId', verifyFirebaseToken, verifyEmail, async (req, res) => {
            const tutorEmail = req.query?.email;
            const query = {
                tutorEmail,
            };
            const result = await tutorialsCollections.find(query).toArray();
            res.send(result);
        })

        app.post('/tutorial', async (req, res) => {
            const tutorial_info = req.body;
            const result = await tutorialsCollections.insertOne(tutorial_info);
            res.send(result);
        });

        app.patch('/tutorial', verifyFirebaseToken, verifyEmail, async (req, res) => {
            const data = req?.body;
            const email = req.query?.email
            const tutorial_id = req.query?.tutorial_id
            const options = { upsert: true }
            const updateDoc = {}
            if (data?.push) {
                updateDoc.$push = {
                    review: data.review
                }
            }
            else if (data?.pull) {
                updateDoc.$pull = {
                    review: data.review
                }
            }
            else {
                updateDoc.$set = data
            }
            const query = { _id: new ObjectId(tutorial_id) };
            const result = await tutorialsCollections.updateOne(query, updateDoc, options);
            res.send(result);
        })

        app.delete('/tutorial', verifyFirebaseToken, verifyEmail, async (req, res) => {
            const email = req.query?.email;
            const tutorial_id = req.query?.tutorial_id;
            const query = {
                _id: new ObjectId(tutorial_id),
            };
            const result = await tutorialsCollections.deleteOne(query);
            res.send(result);
        })


        // tutorialBooking Related APIs
        app.get('/tutorialBooking', verifyFirebaseToken, verifyEmail, async (req, res) => {
            const { email, tutorial_id } = req.query;
            const query = {
                student_email: email
            };
            if (tutorial_id) {
                query.tutorial_id = tutorial_id;
            }
            const result = await tutorialBookingCollections.find(query).toArray();
            res.send(result);
        })

        app.post('/tutorialBooking', async (req, res) => {
            const tutorialBookingInfo = req.body;
            const result = await tutorialBookingCollections.insertOne(tutorialBookingInfo);
            res.send(result);
        });

        app.delete('/tutorialBooking', verifyFirebaseToken, verifyEmail, async (req, res) => {
            const email = req.query?.email;
            const data = req.query?._id;
            const query = {
                _id: new ObjectId(data),
            }
            const result = await tutorialBookingCollections.deleteOne(query);
            res.send(result);
        })



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send(`FluentTalk server is cooking`)
});

app.listen(port, () => {
    console.log(`Fluent-Talk is running on port ${port}`);
})