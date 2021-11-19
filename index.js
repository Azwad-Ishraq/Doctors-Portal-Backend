const express = require('express')
const app = express()
const cors = require('cors')
const admin = require("firebase-admin");
const { MongoClient, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_KEY)
const fileUpload = require('express-fileupload')

app.use(cors())
app.use(express.json())
app.use(fileUpload())



const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});








const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.axy7a.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken (req,res,next){

  if(req.headers.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization.split(' ')[1];


    try{
      const decodedUser = await admin.auth().verifyIdToken(token)
      req.decodedEmail = decodedUser.email
    } catch{
  
    }
  }

  
  next();
}



async function run(){
  try{
    await client.connect()
    

    const database = client.db('doctors_portal')
    const appoinmentsCollection = database.collection('appoinments')
    const doctorsCollection = database.collection('doctors')

    const usersCollection = database.collection('users')

    app.post('/appoinments', async (req,res)=>{
      const appoinment = req.body;
      const result = await appoinmentsCollection.insertOne(appoinment)
      
      res.json(result)
    })
    app.post('/doctors', async (req,res)=>{
      const name = req.body.name
      const email = req.body.email
      const pic = req.files.image
      const picData = pic.data
      const encodedPic = picData.toString('base64')
      const imageBuffer = Buffer.from(encodedPic,'base64')
      const doctor = {
        name,
        email,
        image: imageBuffer

      }
      const result = await doctorsCollection.insertOne(doctor)
      res.json(result)
      
    })

    app.get('/doctors', async (req,res)=>{
      const cursor  = await doctorsCollection.find({})
      const doctors = await cursor.toArray()
      res.json(doctors)
    })

    app.get('/appoinments' , verifyToken, async (req,res)=>{
      const email = req.query.email
      const date = req.query.date
      
      const query = {email: email,date: date}
      const cursor = appoinmentsCollection.find(query)
      const appoinments = await cursor.toArray()
      res.json(appoinments)
    })

    app.post('/users', async (req,res)=>{
      const user = req.body;
      const result = await usersCollection.insertOne(user)
      
      res.json(result)
    })

    app.get('/appoinments/:id',async (req,res)=>{
      const id = req.params.id
      const query = {_id: ObjectId(id)}
      const result = await appoinmentsCollection.findOne(query)
      res.json(result)
    })

    app.put('/appoinments/:id', async (req,res)=>{
      const id = req.params.id;
      const payment = req.body
      const filter = {_id:ObjectId(id)}
      const updateDoc = {
        $set:{
          payment: payment
        }
      }
      const result = await appoinmentsCollection.updateOne(filter,updateDoc)
      res.json(result)
    })

    app.put('/users', async (req,res)=>{
      const user = req.body;
      const filter = {email:user.email}
      const options = {upsert:true}
      const updateDoc = {$set:user}
      const result = await usersCollection.updateOne(filter,updateDoc,options)
      res.json(result)
    })

    app.put('/users/admin', verifyToken, async (req,res)=>{
      const user = req.body;
      const requester = req.decodedEmail

      if(requester){
        const requesterAccount = usersCollection.findOne({email: requester})
        if(requesterAccount.role === 'admin'){
          const filter = {email: user.email}
          const updateDoc = {$set: {role: 'admin'}}
          const result = await usersCollection.updateOne(filter,updateDoc)
          res.json(result)
        }
      }
      else{
        res.status(403).json({message: 'Access Denied'})
      }
      
     

    })

    app.get('/users/:email', async (req,res)=>{
      const email = req.params.email;
      console.log(email)
      const query = {email:email}
      const user = await usersCollection.findOne(query)
      let isAdmin = false
      console.log(user)
      if(user?.role === 'admin')
      {
        isAdmin = true
      }
      res.json({admin: isAdmin})
    })

    app.post('/create-payment-intent', async(req,res)=>{
      const paymentInfo = req.body;
      const amount = paymentInfo.price*100
      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types:['card']
      })
      res.json({clientSecret: paymentIntent.client_secret})
    })
  }



  finally{
    // await client.close()
  }



}
run().catch(console.dir)




app.get('/', (req, res) => {
  res.send('Doctors Portal Server Running....')
})

app.listen(port, () => {
  console.log(` listening at ${port}`)
})