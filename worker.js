     ```typescript
     self.onmessage = () => {
       function doWork() {
         const result = Math.random();
         postMessage({ result });
         setTimeout(doWork, 1000);
       }

       doWork();
     };
     ```

2. **Main Script in Vue Component**
   - In your Vue component, import and use the worker:

     ```vue
     <template>
       <div>
         <button @click="startWorker">Start Worker</button>
         <p>Result: {{ result }}</p>
       </div>
     </template>

     <script lang="ts">
     import { defineComponent, ref } from 'vue';
     // Import the worker
     const Worker = new URL('./worker.ts', import.meta.url);

     export default defineComponent({
       setup() {
         const result = ref<number | null>(null);

         function startWorker() {
           const worker = new Worker(Worker);

           // Listen for messages from the worker
           worker.onmessage = (e) => {
             result.value = e.data.result;
           };

           // Start the worker
           worker.postMessage({});
         }

         return { result, startWorker };
       },
     });
     </script>
     ```
