import mongoose from "mongoose";

const ProductosSchema = mongoose.Schema({
    nombre:{
        type:String,
        required:true,
        trim:true
    },
    existencia:{
        type:Number,
        required:true,
        trim:true
    },
    precio:{
        type:Number,
        required:true,
        trim:true
    },
    creado:{
        type:Date,
        default:Date.now()
    }
});

ProductosSchema.index({nombre: 'text'});//creamos un indice que podemos consultar

export default mongoose.model("Producto", ProductosSchema)