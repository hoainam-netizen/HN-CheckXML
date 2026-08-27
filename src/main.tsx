import { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@ant-design/v5-patch-for-react-19';
import './css/globals.css'
import App from './App.tsx'
import Spinner from './views/spinner/Spinner.tsx'
import "react-toastify/dist/ReactToastify.css";


createRoot(document.getElementById('root')!).render(
    <Suspense fallback={<Spinner />}>
        <App />
    </Suspense>
    ,
)
