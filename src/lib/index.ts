// place files you want to import through the `$lib` alias in this folder.
export interface Save {
  savedApiKeys: ApiKey[]
  savedModels: Model[]
  savedLoRAs: LoRA[]
  savedImages: Image[]
  sign?: "SinkinAPISave"
}


export function mergeData(currentData: Save, dataToLoad: Save): Save | null {
  if (dataToLoad.sign !== "SinkinAPISave") {
    return null
  }
  const mergeById = <T>(current: T[], incoming: T[], idKey: keyof T): T[] => {
    const map = new Map<string, T>()
    for (const item of current) {
      map.set(item[idKey] as string, item)
    }
    for (const item of incoming) {
      map.set(item[idKey] as string, item)
    }
    return Array.from(map.values())
  }

  return {
    savedApiKeys: mergeById(currentData.savedApiKeys, dataToLoad.savedApiKeys, 'code'),
    savedModels: mergeById(currentData.savedModels, dataToLoad.savedModels, 'id'),
    savedLoRAs: mergeById(currentData.savedLoRAs, dataToLoad.savedLoRAs, 'id'),
    savedImages: mergeById(currentData.savedImages, dataToLoad.savedImages, 'image_url'),
  }
}

export function getDateFilename(extension = 'json', configName?: string) {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')   // Mes 0-11, sumamos 1
  const day = String(now.getDate()).padStart(2, '0')

  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day}_${hour}-${minute}-${second}-${configName ?? 'config'}.${extension}`
}

export function exportSave(filename: string, content: Save) {
  content.sign = "SinkinAPISave"
  const blob = new Blob([JSON.stringify(content)], { type: 'application/json' }); // o 'application/json', etc.
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;

  // Forzar el clic para iniciar la descarga
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url); // liberar memoria
}

export async function importSave(file: File, currentData: Save): Promise<boolean> {
  try {
    const dataToLoad = await readJsonFile(file)
    if (dataToLoad.sign !== "SinkinAPISave") {
      console.error("The imported configuration is not valid:", dataToLoad)
      return false
    }
    currentData.sign = "SinkinAPISave"
    const mergedData = mergeData(currentData, dataToLoad)
    localStorage.setItem('apiKeys', JSON.stringify(mergedData?.savedApiKeys))
    localStorage.setItem('images', JSON.stringify(mergedData?.savedImages))
    localStorage.setItem('models', JSON.stringify(mergedData?.savedModels))
    localStorage.setItem('loras', JSON.stringify(mergedData?.savedLoRAs))
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readJsonFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string)
        resolve(json)
      } catch (err) {
        reject(err)
      }
    }

    reader.onerror = () => {
      reject(reader.error)
    }

    reader.readAsText(file)
  })
}

export function promptFile(accept = 'application/json'): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept

    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        resolve(input.files[0])
      } else {
        resolve(null)
      }
    }

    input.click()
  })
}

export interface ImgRequest {
  // Required
  /**
   * Access token (API Key)
   */
  access_token: string;
  /**
   * Model ID
   */
  model_id: string;
  /**
   * Prompt text
   */
  prompt: string;

  // Optional with defaults and validation notes
  /**
   * Model version, defaults to latest version
   */
  version?: string;
  /**
   * Default = 512, must be multiple of 8, range 128-896 (common: 512, 640, 768)
   */
  width?: number;
  /**
   * Default = 768, must be multiple of 8, range 128-896 (common: 512, 640, 768)
   */
  height?: number;

  /**
   * Optional negative prompt
   */
  negative_prompt?: string;
  /**
   * Whether to append default negative prompt, default = "true"
   */
  use_default_neg?: 'true' | 'false';

  /**
   * Number of inference steps, default = 30, range 1-50
   */
  steps?: number;
  /**
   * Guidance scale, default = 7.5 or model's default, range 1-20
   */
  scale?: number;

  /**
   * Number of images, default = 4
   */
  num_images?: number;
  /**
   * Seed, default = random (-1)
   */
  seed?: number;
  /**
   * Scheduler, default = "DPMSolverMultistep" or model's default
   */
  scheduler?: string;

  /**
   * LoRA model ID, query /models to get full list
   */
  lora?: string;
  /**
   * LoRA scale, default = 0.75
   */
  lora_scale?: number;

  // ControlNet
  /**
   * Valid values for ControlNet
   */
  controlnet?: 'canny' | 'depth' | 'openpose';
}

export interface Img2ImgRequest extends ImgRequest {
  // For img2img (image transformation)
  /**
   * Base image file, required for img2img
   */
  init_image_file?: File;
  /**
   * How much to transform base image, default = 0.75
   */
  image_strength?: number;
}

export interface ApiKey {
  code: string;
  creditsLeft: number
}

export interface Model {
  id: string
  title: string
  description: string
}

export interface Image extends Img2ImgRequest {
  /**
   * Generated image URL
   */
  image_url: string
}

export interface ErrorResponseFromSinkin {
  error_code: number
  message: string
}

export interface SuccessfulImageGenerationResponse {
  error_code: number,
  images: string[]
  credit_cost: number,
  inf_id: string
}

export interface LoRA {
  id: string
  title: string
  description: string
}