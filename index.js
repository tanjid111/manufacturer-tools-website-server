const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express()
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ynggczz.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).send({ message: 'Unauthorized Access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const productCollection = client.db('manufacturer_tools').collection('products');
        const reviewCollection = client.db('manufacturer_tools').collection('reviews');
        const purchaseCollection = client.db('manufacturer_tools').collection('purchase');
        const userCollection = client.db('manufacturer_tools').collection('users');
        const userProfileCollection = client.db('manufacturer_tools').collection('usersProfile');
        const paymentCollection = client.db('manufacturer_tools').collection('payments');

        // Verify Admin  function
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        }
        /* ----------------------------------------------------Products-------------------------------------------- */
        //Get All Products
        app.get('/products', async (req, res) => {
            const query = {};
            const cursor = productCollection.find(query)
            const products = await cursor.toArray();
            res.send(products)
        })

        //Get single product
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await productCollection.findOne(query);
            res.send(product)
        })

        //Update product
        app.put('/products/:id', async (req, res) => {
            const id = req.params.id;
            const updatedProduct = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    availableQuantity: updatedProduct.availableQuantity,
                }
            }
            const product = await productCollection.updateOne(filter, updatedDoc, options);
            res.send(product);
        })
        //Adding/Posting Doctor from Add a doctor dashboard
        app.post('/products', async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send({ success: true, result });
        })

        //Delete Products from Manage orders by Admin
        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await productCollection.deleteOne(filter);
            res.send(result)
        })


        /* ----------------------------------------------------Reviews-------------------------------------------- */

        //Get All Reviews
        app.get('/reviews', async (req, res) => {
            const query = {};
            const cursor = reviewCollection.find(query)
            const reviews = await cursor.toArray();
            res.send(reviews)
        })

        //Post new reviews
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send({ success: true, result });
        })


        /* ----------------------------------------------------Purchases-------------------------------------------- */
        //Post new purchase
        app.post('/purchase', async (req, res) => {
            const purchase = req.body;
            const result = await purchaseCollection.insertOne(purchase);
            res.send({ success: true, result });
        })

        //Get purchase with user's email id for MyOrder dashboard
        app.get('/purchase', verifyJWT, async (req, res) => {
            const customerEmail = req.query.customerEmail;
            const decodedEmail = req.decoded.email;
            if (customerEmail === decodedEmail) {
                const query = { customerEmail: customerEmail };
                const purchases = await purchaseCollection.find(query).toArray();
                return res.send(purchases);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        })

        //Delete Purchase from My orders by  user
        app.delete('/purchase/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await purchaseCollection.deleteOne(filter);
            res.send(result)
        })

        ////Get Purchase data for payment by  user
        app.get('/purchase/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const purchase = await purchaseCollection.findOne(query);
            res.send(purchase)
        })

        app.get('/purchase', verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};
            const cursor = purchaseCollection.find(query)
            const purchase = await cursor.toArray();
            res.send(purchase)
        })

        app.patch('/purchase/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedPurchase = await purchaseCollection.updateOne(filter, updatedDoc);
            res.send(updatedDoc);
        })

        /* ----------------------------------------------------Users-------------------------------------------- */
        ///Making user admin
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updatedDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);

        })

        //Making admin api to make sure that only admin can access some restricted routes in dashboard
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        ////Adding or Updating a user or a new user from use token
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: user,
            };
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            res.send({ result, token });
        })

        //get users for make admin
        app.get('/user', verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};
            const cursor = userCollection.find(query)
            const users = await cursor.toArray();
            res.send(users)
        })
        /* ----------------------------------------------------User Collection-------------------------------------------- */
        // app.post('/userProfile', async (req, res) => {
        //     const userProfile = req.body;
        //     const result = await userProfileCollection.insertOne(userProfile);
        //     res.send({ success: true, result });
        // })
        app.put('/userProfile/:email', async (req, res) => {
            const email = req.params.email;
            const userProfile = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: userProfile,
            };

            const result = await userProfileCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        app.post('/userProfile', async (req, res) => {
            const userProfile = req.body;
            const result = await userProfileCollection.insertOne(userProfile);
            res.send({ success: true, result });
        })

        app.get('/userProfile', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const cursor = userProfileCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })
        /* ----------------------------------------------------Payment-------------------------------------------- */
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const product = req.body;
            const price = product.totalPrice;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })

        })
    }
    finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Manufacturer app is running!')
})

app.listen(port, () => {
    console.log(`Manufacturer app listening on port ${port}`)
})