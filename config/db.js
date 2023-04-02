import mongoose from "mongoose";
import dotenv from "dotenv"
dotenv.config({path:'.env'});

const conectarDB = async()=>{
    try {
        await mongoose.set('strictQuery', false)
        await mongoose.connect(process.env.DB_MONGO);
        console.log('db conectada')
    } catch (error) {
        console.log(error);
        process.exit(1);//detiene la aplicacion
    }
}

export default conectarDB;