var express = require('express');
var app = express();
var request = require('request');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

const hosturl = "localhost:3000";
const fournisseurUrl = "http://25.14.207.84:3000/api/receive-products/"

// Import the functions you need from the SDKs you need
const firebaseapp = require("firebase/app");
const firestore = require("firebase/firestore/lite");
const { collection, getDocs, where } = require('firebase/firestore/lite');
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC5-xBFR5q4rarwNxV8crbjyxLOBt9Zaw8",
  authDomain: "project-api-6f00c.firebaseapp.com",
  projectId: "project-api-6f00c",
  storageBucket: "project-api-6f00c.appspot.com",
  messagingSenderId: "146067562884",
  appId: "1:146067562884:web:33205cd3a8a49acd2dfdd1"
};

// Initialize Firebase
const appFirebase = firebaseapp.initializeApp(firebaseConfig);
const db = firestore.getFirestore(appFirebase);

var reapThreshhold = 4;

app.get('/', async function (req, res) {
  const productsDb = collection(db, 'products');
  const productsDocs = await getDocs(productsDb);
  const productsList = productsDocs.docs.map(doc => doc.data());
  
  res.send(productsList)
});

app.get('/product', async function (req, res) {
  const productsDb = collection(db, 'products');
  const productsDocs = await getDocs(productsDb);
  const productsList = productsDocs.docs.map(doc => doc.data());
  
  res.send(productsList)
});

app.get('/product/update', async function (req, res) {
    const query = req.query;
    const products = query["products"];

    if (!products)
      res.send("For usage, look at " + hosturl + "/api-docs");
    
    const productsArray = JSON.parse(products);
    if (!productsArray || !Array.isArray(productsArray))
      res.send("Wrong usage, products is not of type: Array. Look at " + hosturl + "/api-docs");

    const result = await updateProducts(productsArray);

    res.send(
      "Products under quantity: " + reapThreshhold + " automatically create an order request <br>" + JSON.stringify(result)
    );
  });

app.get('/product/search', async function (req, res) {
    const query = req.query;
    const products = query["product"];

    if (!products)
      res.send("For usage, look at " + hosturl + "/api-docs");
    
    const productsArray = JSON.parse(products);
    if (!productsArray)
      res.send("Wrong usage, product is not of type: Object. Look at " + hosturl + "/api-docs");

    const result = await searchProduct(productsArray);

    res.send(
      result
    );
  });

app.get('/product/add', function (req, res) {
    const query = req.query;
    const products = query["products"];

    if (!products)
      res.send("For usage, look at " + hosturl + "/api-docs");
    
    const productsArray = JSON.parse(products);
    if (!productsArray || !Array.isArray(productsArray))
      res.send("Wrong usage, products is not of type: Array. Look at " + hosturl + "/api-docs");

    const result = addProductsToDb(productsArray);

    res.send(
      result
    );
  });

app.get('/product/updateStock', function (req, res) {
    const query = req.query;
    const products = query["products"];

    if (!products)
      res.send("For usage, look at " + hosturl + "/api-docs");
    
    const productsArray = JSON.parse(products);
    if (!productsArray || !Array.isArray(productsArray))
      res.send("Wrong usage, products is not of type: Array. Look at " + hosturl + "/api-docs");

    const result = updateStockProduct(productsArray);

    res.send(
      result
    );
  })

async function updateProducts(productsArray) {
  let returnProducts = [];
  let toReapProducts = [];

  productsArray.forEach(async product => {

    if (product["name"]) {
      firestore.setDoc(firestore.doc(db, "products", product["name"]),
        product
      );
      if (product["quantity"] && product["quantity"] < reapThreshhold) {
        toReapProducts.push(product);
      }
      returnProducts.push(product);
    }
  });

  if (toReapProducts.length > 0) {
    request.post(
      fournisseurUrl,
      { json: toReapProducts },
      function (error, response, body) {
          if (!error && response.statusCode == 200) {
              console.log(body);
          }
      }
    );
  }

  return returnProducts;
}

async function addProductsToDb(productsArray) {
  let returnProducts = [];
  let shouldSkip = false;

  const dbProductsRef = await getDocs(firestore.collection(db, "products"));
  const productsList = dbProductsRef.docs.map(doc => doc.data());

  productsArray.forEach(async product => {
    shouldSkip = false;
    if (product["name"] && !shouldSkip) {
      productsList.forEach(element => {
        if (product["name"] == element["name"]) {
          shouldSkip = true;
          return
        }
      });

      firestore.setDoc(firestore.doc(db, "products", product["name"]),
        product
      );
    }
  })

  return returnProducts;
}

async function searchProduct(productObj) {
  let foundProduct = null;

  if (productObj["name"])
    foundProduct = await firestore.getDoc(firestore.doc(db, "products", productObj["name"]));
  
  return foundProduct.exists() ? foundProduct.data() : {};
}

function updateStockProduct(productsArray) {
  let updatedProducts = []

  productsArray.forEach(element => {
    if (element["name"] && element["quantity"]) {
      firestore.updateDoc(firestore.doc(db, "products", element["name"]),
        {
          quantity: element["quantity"]
        }
      );

      updatedProducts.push(element)
    }
  });

  return updatedProducts
}

var options = {
  swaggerOptions: {
    validatorUrl: null
  }
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, options));

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
