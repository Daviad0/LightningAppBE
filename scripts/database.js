const mongoose = require('mongoose');


const models = {
    'Account' : mongoose.model('Account',new mongoose.Schema({
        email: String,
        group: String,
        pwhash: String,
        pwsalt: String,
        pwiterations: Number,
        username: String,
        uuid: String,
        access: {
            roles: [String],
            restricted: Boolean,
            elevated: Boolean
        },
        connections:[String],
        attendance:[{
            event: String,
            status: String,
            overriddenstatus: String,
            datetime: Date
        }]
    })),
    'Group' : mongoose.model('Group', new mongoose.Schema({
        name: String,
        uniqueId: String,
        locked: Boolean,
        affiliations: [String]
    })),
    'ModuleItem' : mongoose.model('ModuleItem', new mongoose.Schema({
        group: String,
        title: String,
        contents: String,
        icon: String,
        image: String,
        result: {
            to: String,
            data: String
        },
        details: {
            start: Date,
            end: Date
        },
        show: Boolean
    })),
    'AttendanceItem' : mongoose.model('AttendanceItem', new mongoose.Schema({
        group: String,
        title: String,
        description: String,
        datetime: Date,
        length: Number,
        code: String
    }))
}

async function init(){
    await mongoose.connect('mongodb://23.28.58.218:19132/lightningapp', { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to mongodb');

    
    var groups = await getDocs('Group', {uniqueId: 'testing-env'});
    if(groups.length == 0){
        await createDoc('Group', {name: 'Testing Environment', uniqueId: 'testing-env', locked: false, affiliations: []});
    }

    var items = await getDocs('ModuleItem', {group: 'testing-env'});
    if(items.length == 0){
        await createDoc('ModuleItem', {group: 'testing-env', title: 'Test Item', contents: 'Here are some contents...', icon: 'favorite', image: '', result: {to: 'link', data: 'https://bit.ly/LRLanding'}, show: true});
    }

    var items = await getDocs('AttendanceItem', {group: 'testing-env'});
    if(items.length == 0){
        await createDoc('AttendanceItem', {group: 'testing-env', title: 'Very Important Meeting', description: 'Must Attend or Die', datetime: new Date(), length: 2, code: '12345'});
    }

}

async function createDoc(type, data){
    var doc = new models[type](data);
    await doc.save();
    return doc;
}

async function getDocs(type, query){
    return await models[type].find(query);
}

async function updateDoc(type, query, data){
    await models[type].updateOne(query, {$set: data});
    return await getDocs(type, query);
}

module.exports = {
    init,createDoc,getDocs,updateDoc
}