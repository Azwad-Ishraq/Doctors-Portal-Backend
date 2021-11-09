const express = require('express')
const app = express()
const cors = require('cors')
const admin = require("firebase-admin");
const { MongoClient } = require('mongodb');
const port = process.env.PORT || 5000
require('dotenv').config()

app.use(cors())
app.use(express.json())




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

    const usersCollection = database.collection('users')

    app.post('/appoinments', async (req,res)=>{
      const appoinment = req.body;
      const result = await appoinmentsCollection.insertOne(appoinment)
      
      res.json(result)
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
  }
  finally{
    // await client.close()
  }
}
run().catch(console.dir)




app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(` listening at ${port}`)
})