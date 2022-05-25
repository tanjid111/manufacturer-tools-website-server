const express = require('express')
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ynggczz.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const productCollection = client.db('manufacturer_tools').collection('products');
        const reviewCollection = client.db('manufacturer_tools').collection('reviews');
        const purchaseCollection = client.db('manufacturer_tools').collection('purchase');

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

        //Post new purchase
        app.post('/purchase', async (req, res) => {
            const purchase = req.body;
            const result = await purchaseCollection.insertOne(purchase);
            res.send({ success: true, result });
        })

        //Get purchase with user's email id for MyOrder dashboard
        app.get('/purchase', async (req, res) => {
            const customerEmail = req.query.customerEmail;
            const query = { customerEmail: customerEmail };
            const purchases = await purchaseCollection.find(query).toArray();
            res.send(purchases);
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