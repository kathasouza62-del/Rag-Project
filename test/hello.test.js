const request = require('supertest');
const express = require('express');
const helloRoutes = require('../src/routes/hello');

const app = express();
app.use('/', helloRoutes);

describe('GET /hello', () => {
    it('should return Hello, World message', async () => {
        const res = await request(app).get('/hello');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ message: 'Hello, World!' });
    });
});

