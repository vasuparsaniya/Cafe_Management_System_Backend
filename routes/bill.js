const express = require('express');
const connection = require('../connection');
const router = express.Router();
let ejs = require('ejs');
let puppeteer = require('puppeteer');
let path = require('path');
var fs = require('fs');
var uuid = require('uuid');
var auth = require('../services/authentication');

//----------------------generate report API-------------------------
router.post('/generateReport', auth.authenticateToken, async (req, res) => {
    const generatedUuid = uuid.v1();  //Generate a UUID based on the current time and the MAC address of the Machine
    const orderDetails = req.body;
    var productDetailsReport = JSON.parse(orderDetails.productDetails);  //JSON.parse() it is convert JSON format to JavaScript object

    var query = "insert into bill (name,uuid,email,contactNumber,paymentMethod,total,productDetails,createdBy) values(?,?,?,?,?,?,?,?)";
    connection.query(query, [orderDetails.name, generatedUuid, orderDetails.email, orderDetails.contactNumber, orderDetails.paymentMethod, orderDetails.totalAmount, orderDetails.productDetails, res.locals.email], async (err, results) => {
        if (!err) {
            try {
                const browser = await puppeteer.launch();
                const page = await browser.newPage();
                const htmlContent = await ejs.renderFile(path.join(__dirname, '', "report.ejs"), {
                    productDetails: productDetailsReport,
                    name: orderDetails.name,
                    email: orderDetails.email,
                    contactNumber: orderDetails.contactNumber,
                    paymentMethod: orderDetails.paymentMethod,
                    totalAmount: orderDetails.totalAmount
                });
                await page.setContent(htmlContent);
                await page.pdf({ path: './generated_pdf/' + generatedUuid + ".pdf" });
                await browser.close();

                return res.status(200).json({ uuid: generatedUuid });
            } catch (err) {
                console.error(err);
                return res.status(500).json(err);
            }
        } else {
            return res.status(500).json(err);
        }
    });
});

//---------------------Send the uuid and get the pdf if pdf not exist then create and return API-------------------------
router.post('/getPdf', auth.authenticateToken, async (req, res) => {
    const orderDetails = req.body;
    const pdfPath = './generated_pdf/' + orderDetails.uuid + '.pdf';

    if (fs.existsSync(pdfPath)) {
        // Return the existing PDF file
        res.contentType("application/pdf");
        fs.createReadStream(pdfPath).pipe(res);
    } else {
        try {
            var productDetailsReport = JSON.parse(orderDetails.productDetails);
            // const browser = await puppeteer.launch();
            const browser = await puppeteer.launch({ headless: "new" });
            const page = await browser.newPage();
            const htmlContent = await ejs.renderFile(path.join(__dirname, '', "report.ejs"), {
                productDetails: productDetailsReport,
                name: orderDetails.name,
                email: orderDetails.email,
                contactNumber: orderDetails.contactNumber,
                paymentMethod: orderDetails.paymentMethod,
                totalAmount: orderDetails.totalAmount
            });
            await page.setContent(htmlContent);
            await page.pdf({ path: pdfPath });
            await browser.close();

            // Return the newly created PDF file
            res.contentType("application/pdf");
            fs.createReadStream(pdfPath).pipe(res);
        } catch (err) {
            console.error(err);
            return res.status(500).json(err);
        }
    }
});

//--------------------Get Bills API-----------------------------------
router.get('/getBills', auth.authenticateToken, (req, res, next) => {
    var query = "select * from bill order by id DESC"; //DESC-->decreasing order
    connection.query(query, (err, results) => {
        
    if (!err) {
    return res.status(200).json(results);
    }
    else {
    return res.status(500).json(err);
    }
    })
    });
    
    //--------------------Delete Bill API--------------------------------
    router.delete('/delete/:id', auth.authenticateToken, (req, res, next) => {
    const id = req.params.id;
    var query = "delete from bill where id=?";
    connection.query(query, [id], (err, results) => {
    if (!err) {
    if (results.affectedRows == 0) {
    return res.status(404).json({ "message": "Bill id does not found" });
    }
    return res.status(200).json({ "message": "Bill deleted successfully" });
    }
    else {
    return res.status(500).json(err);
    }
    })
    });
    
    module.exports = router;
