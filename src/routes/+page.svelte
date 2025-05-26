<script lang="ts">
	import type { ApiKey, ErrorResponseFromSinkin, Image, Img2ImgRequest, LoRA, Model, SuccessfulImageGenerationResponse } from '$lib';
	import { exportSave, getDateFilename, importSave, isGalleryOpen, promptFile } from '$lib';
	import autosize from 'svelte-autosize';

	import { Button, Input, Modal, ModalFooter, Spinner, Styles, Toast } from '@sveltestrap/sveltestrap';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import Gallery from '../components/gallery.page.svelte';

  const sinkinHost = 'https://sinkin.ai/'

  const SinkinEndpoints = {
    NewImage: sinkinHost + "api/inference",
    RetrieveAvailableModels: sinkinHost + "api/models",
    Upscale: sinkinHost + "api/upscale"
  }

  const loadedApiKeys = writable<ApiKey[]>([])
  const currentApiKey = writable<ApiKey | null>(null)
  const savedModels = writable<Model[]>([])
  const savedImages = writable<Image[]>([])
  const savedLoras = writable<LoRA[]>([])


  type AvailableSchedulers = "DDIM" | "K_EULER" | "K_EULER_ANCESTRAL" | "DPMSolverMultistep" | "PNDM" | "KLMS"

  // Common options
  let prompt = $state('')
  let quantityOfImages = $state(2)
  const noLora: LoRA = {
    id: '0',
    title: 'No LoRA',
    description: 'No LoRA selected'
  }
  let loraSelected: LoRA = $state(noLora)
  let fileSelected: File | undefined = $state(undefined)
  // Advanced options
  let advancedOptions = $state(false)
  let modelVersion: number | undefined = $state(undefined)
  let negativePrompt: string | undefined = $state(undefined)
  let useDefaultNegativePrompt: boolean = $state(true)
  let numberOfInferenceSteps: number | undefined = $state(undefined)
  let guidanceScale: number | undefined = $state(undefined)
  let seed: number | undefined = $state(undefined)
  let scheduler: AvailableSchedulers = $state("DPMSolverMultistep")
  let configExportNameInput = $state('');
  const commonSizes = [512, 640, 768, 896, 1024];
  let width: number = $state(768)
  let height: number = $state(768)
  let loraScale: number = $state(0.75)

  let loading = $state(false)
  const creditsLeft = writable(0)

  onMount(() => {
    const rawApiKeys = localStorage.getItem('apiKeys')
    if (rawApiKeys != null) {
      const apiKeys = JSON.parse(rawApiKeys)
      loadedApiKeys.set(apiKeys)
    }
    const rawModels = localStorage.getItem('models')
    if (rawModels != null) {
      const models: Model[] = JSON.parse(rawModels)
      savedModels.set(models)
    }
    const rawImages = localStorage.getItem('images')
    if (rawImages != null) {
      const images: Image[] = JSON.parse(rawImages)
      savedImages.set(images)
    }
    const rawLoras = localStorage.getItem('loras')
    if (rawLoras != null) {
      const loras: LoRA[] = JSON.parse(rawLoras)
      savedLoras.set(loras)
    }

    creditsLeft.set(availableCredits())
  })

  let apiKeyInput: string = $state('')

  function addApiKey() {
    if (apiKeyInput === '') return
    const newApiKey: ApiKey = { code: apiKeyInput, creditsLeft: 100 }
    $loadedApiKeys.push(newApiKey)
    creditsLeft.set($creditsLeft + 100)
    localStorage.setItem('apiKeys', JSON.stringify($loadedApiKeys))
    showToast({
      title: 'The API key has been added',
      description: `
      <p>
      API key added: ${apiKeyInput}
      <br/>
      Note the key is not verified and will throw a error if is invalid<p>
      `
    })
  }

  function removeApiKey() {
    if (apiKeyInput === '') return
    loadedApiKeys.set($loadedApiKeys.filter(apiKey => apiKey.code !== apiKeyInput))
    creditsLeft.set($creditsLeft - 100)
    localStorage.setItem('apiKeys', JSON.stringify($loadedApiKeys))
    showToast({
      title: 'The API key has been removed',
      description: `
      <p>
      API key removed: ${apiKeyInput}
      <p>
      `
    })
  }

  function showApiKeyInformation() {
    if (apiKeyInput === '') return
    const apiKey = $loadedApiKeys.find(key => key.code === apiKeyInput)
    if (apiKey == null) {
      return showToast({
      title: 'API Key not found',
      description: `
      <p>
      API key: ${apiKeyInput}
      <br/>
      Maybe you need to store it first
      <p>
      `
    })
    }
    showToast({
      title: 'API Key information',
      description: `
      <p>
      API key: ${apiKeyInput}
      <br/>
      API Key credits left: ${apiKey.creditsLeft}
      <p>
      `
    })
  }

  function setCurrentApiKey(code: string) {
    currentApiKey.set($loadedApiKeys.find(apiKey => apiKey.code === code) ?? null)
  }

  function isAffordableApiKey(minCredits: number) {
    return $currentApiKey != null && $currentApiKey.creditsLeft >= minCredits
  }

  function findAffordableApiKey(minCredits: number) {
    return $loadedApiKeys.find(apiKey => apiKey.creditsLeft >= minCredits) ?? null
  }


  let modelIdInput = $state('')
  let modelTitleInput = $state('')
  let modelDescriptionInput = $state('')
  function addModel() {
    if (modelIdInput === '' ||
    modelTitleInput === '' ||
    modelDescriptionInput === ''
    ) {
      return showToast({
      title: 'Fill all the required fields first',
      description: `
      Fill the ID, title and description of the model
      `
    })
    }

    const newModel: Model = {
      description: modelDescriptionInput,
      title: modelTitleInput,
      id: modelIdInput
    }
    $savedModels.push(newModel)
    localStorage.setItem('models', JSON.stringify($savedModels))
    showToast({
      title: 'Model has been stored',
      description: `
      <p>
      Model title: ${newModel.title}
      <br/>
      Model description: ${newModel.description}
      <br/>
      Model ID: ${newModel.id}
      <p>
      `
    })
  }

  function removeModel() {
    if (modelIdInput === '') return
    const savedModel = $savedModels.find(model => model.id === modelIdInput)
    if (savedModel === null) {
      return showToast({
      title: 'That model was not found',
      description: `
      Maybe you need to store it first
      `
    })
    }
    savedModels.set($savedModels.filter(model => model.id !== modelIdInput))
    localStorage.setItem('models', JSON.stringify($savedModels))
  }

  function addImage(newImage: Image) {
    $savedImages.push(newImage)
    localStorage.setItem('images', JSON.stringify($savedImages))
  }

  function removeImage(imageUrl: string) {
    savedImages.set($savedImages.filter(image => image.image_url !== imageUrl))
    localStorage.setItem('images', JSON.stringify($savedImages))
    showToast({
      title: 'The image has been removed',
      description: `
      <p>
      Image URL: ${imageUrl}
      </p>
      `
    })
  }

  function deleteAllImages() {
    savedImages.set([])
    localStorage.removeItem('images')
    showToast({
      title: 'All the images has been removed',
      description: `
      Why?
      `
    })
  }

  function deleteAllKeys() {
    savedImages.set([])
    localStorage.removeItem('apiKeys')
    showToast({
      title: 'All the API keys has been removed',
      description: `
      Why?
      `
    })
  }

  function deleteAllModels() {
    savedImages.set([])
    localStorage.removeItem('models')
    showToast({
      title: 'All the models has been removed',
      description: `
      Why?
      `
    })
  }

  function deleteAllLoRAs() {
    savedImages.set([])
    localStorage.removeItem('loras')
    showToast({
      title: 'All the LoRAs has been removed',
      description: `
      Why?
      `
    })
  }

  let loraIdInput = $state('')
  let loraTitleInput = $state('')
  let loraDescriptionInput = $state('')
  function addLoRA() {
    if (loraIdInput == null) return
    const savedLora = $savedLoras.find(lora => lora.id === loraIdInput)
    if (savedLora != null) {
      return showToast({
      title: 'That LoRA is already stored',
      description: `
      Maybe you are going too fast?
      `
    })
    }
    if (loraTitleInput === '' || loraDescriptionInput === '') {
      return showToast({
      title: 'Fill all the required fields first',
      description: `
      Fill the ID, title and description of the LoRA
      `
    })
    }
    const newLoRA: LoRA = {
      description: loraDescriptionInput,
      title: loraTitleInput,
      id: loraIdInput
    }
    $savedLoras.push(newLoRA)
    localStorage.setItem('loras', JSON.stringify($savedLoras))
  }

  function removeLoRA() {
    if (loraIdInput === '') return 
    const savedLora = $savedLoras.find(lora => lora.id === loraIdInput)
    if (savedLora == null) {
      return showToast({
      title: 'The LoRA was not found',
      description: `
      LoRA ID: ${loraIdInput}
      `
    })
    }
    savedLoras.set($savedLoras.filter(lora => lora.id !== loraIdInput))
    localStorage.setItem('loras', JSON.stringify($savedLoras))
    showToast({
      title: 'The LoRA has been removed',
      description: `
      LoRA ID: ${loraIdInput}
      LoRA title: ${loraTitleInput}
      LoRA description: ${loraDescriptionInput}
      `
    })
  }

  let maxCreditsInput = $state(15);
  let selectedModel: Model | null = $state(null)

  async function decrementApiKeyCredits(creditCost: number, apiKeyCode: string) {
    loadedApiKeys.set($loadedApiKeys.map(key => {
      if (key.code === apiKeyCode) {
        console.log("Decrementing:", creditCost, "to:", apiKeyCode)
        creditsLeft.set($creditsLeft - creditCost)
        return {
          code: apiKeyCode,
          creditsLeft: key.creditsLeft - creditCost
        }
      }
      return key
    }))
    window.localStorage.setItem('apiKeys', JSON.stringify($loadedApiKeys))
  }

  async function generateNewImage(): Promise<void> {
    if ($loadedApiKeys.length === 0) {
      showToast({
        title: 'There are not API keys',
        description: 'Add a valid API key with at least 100 credits to start'
      })
      throw new Error('Can not generate a image without an API key')
    }
    if ($currentApiKey == null) {
      currentApiKey.set(findAffordableApiKey(maxCreditsInput))
    }
    if (selectedModel == null) {
      showToast({
        title: 'Select a model first',
        description: `
        <a href="https://sinkin.ai/?models=1" target="_blank" rel="noopener noreferrer">
          Get valid models IDs and examples here
        </a>`
      })
      throw new Error('Can not generate a image without a valid model ID')
    } else {
      console.log("Selected model:", selectedModel)
    }
    if (prompt === '') {
      showToast({
        title: 'Add a prompt first',
        description: 'A prompt is required'
      })
      throw new Error('Can not generate a image without a prompt')
    }
    const options: Img2ImgRequest = {
      access_token: ($currentApiKey as ApiKey).code,
      model_id: selectedModel.id,
      prompt,
      height,
      width,
      version: `${modelVersion}` === 'undefined' ? undefined : `${modelVersion}`,
      negative_prompt: negativePrompt,
      use_default_neg: useDefaultNegativePrompt === true ? "true" : "false",
      steps: numberOfInferenceSteps,
      scale: guidanceScale,
      seed,
      scheduler: scheduler,
      num_images: quantityOfImages,
      lora: (loraSelected?.id ?? '0') !== '0' ? loraSelected.id : undefined,
      lora_scale: loraScale
    }
    try {
      const form = new FormData();

      if (fileSelected != null) {
        form.append('init_image_file', fileSelected);
      }

      for (const [key, value] of Object.entries(options)) {
        if (value !== undefined && value !== null) {
          form.append(key, value.toString());
        }
      }

      console.log(options)

      for (const [key, value] of form.entries()) {
        console.log(`Form KV: ${key} =`, value);
      }

      const res = await fetch(SinkinEndpoints.NewImage, {
        method: 'POST',
        body: form
      })
  
      if (!res.ok) {
        try {
          const data = (await res.json()) as ErrorResponseFromSinkin
          console.log('The image could not be generated:', data)
          return showToast({
            title: 'The image could not be generated',
            description: `
            <p>
            Error: ${JSON.stringify(data)}
            <br/>
            Status: ${res.status}
            <br/>
            StatusText: ${res.statusText}
            </p>`
        })
        } catch (error) {
          return showToast({
            title: 'The image could not be generated',
            description: `
            <p>
            Error: [Invalid JSON, the server didn't send a JSON response]
            <br/>
            Status: ${res.status}
            <br/>
            StatusText: ${res.statusText}
            </p>`
          })
        }
      } else {
        try {
          const data = (await res.json()) as SuccessfulImageGenerationResponse
          if (data.error_code != 0) {
            console.log('The image could not be generated:', data)
            return showToast({
              title: 'The image has been not generated',
              description: `
              <p>
              Error: ${JSON.stringify(data)}
              <br/>
              Status: ${res.status}
              <br/>
              StatusText: ${res.statusText}
              </p>`
          })
          }
          data.images.forEach(image_url => {
            addImage({
              ...options,
              image_url
            })
          })
          console.log($currentApiKey, data.credit_cost)
          await decrementApiKeyCredits(data.credit_cost, ($currentApiKey as any).code)
          console.log(`${data.images.length} images has been generated and saved`)
          return showToast({
            title: 'The image/s has been generated',
            description: `
            <p>
            Image URL/s: ${data.images}
            <br/>
            Credit cost: ${data.credit_cost}
            <br/>
            You can view them at /gallery
            </p>
            `
          })
        } catch (error) {
          return showToast({
            title: 'The image could not be generated',
            description: `
            <p>
            Error: [Invalid JSON, the server didn't send a JSON response]
            <br/>
            Status: ${res.status}
            <br/>
            StatusText: ${res.statusText}
            </p>`
          })
        }
      }
    } catch (error) {
      console.error(error)
      return showToast({
        title: 'The image could not be generated',
        description: `
        <p>
        Network error, check your internet connection, the error has been printed to the console
        </p>`
      })
    }
  }

  // async function img2imgNewImage(options: Img2ImgRequest, file: File): Promise<SuccessfulImageGenerationResponse | ErrorResponseFromSinkin | null> {
  //   try {
  //     const form = new FormData();

  //     for (const [key, value] of Object.entries(options)) {
  //       if (value !== undefined && value !== null) {
  //         form.append(key, value.toString());
  //       }
  //     }

  //     form.append('init_image_file', file);

  //     const res = await fetch(SinkinEndpoints.NewImage, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'multipart/form-data'
  //       },
  //       body: form
  //     })
  
  //     if (!res.ok) {
  //       return (await res.json()) as ErrorResponseFromSinkin
  //     } else {
  //       return (await res.json()) as SuccessfulImageGenerationResponse
  //     }
  //   } catch (error) {
  //     console.error(error)
  //     return null
  //   }
  // }

  function availableCredits() {
    let creditsLeft = 0;
    $loadedApiKeys.forEach(apiKey => {
      creditsLeft += apiKey.creditsLeft
    })
    return creditsLeft
  }

  let openModal = $state(false);
  let modalText = $state('Modal text')
  let modalTitle = $state('Modal title')
  let modalCallback: null | (() => void) = $state(null)

  const toggleModal = () => (openModal = !openModal);

  let modalSetInput = $state(false)

  function showConfirmationModal(opts: {
    title: string,
    description: string,
    callbackFn: () => void,
  }) {
    modalTitle = opts.title
    modalText = opts.description
    modalCallback = async () => {
      await opts.callbackFn()
      modalCallback = null
    }
    openModal = true;
  }

  function showModal(opts: {
    title: string,
    description: string
  }) {
    modalTitle = opts.title
    modalText = opts.description
    openModal = true;
  }

  let openToast = $state(false)
  let toastHeader = $state('Toast header')
  let toastBody = $state('Toast body')

  function showToast(opts: {
    title: string,
    description: string
  }) {
    toastHeader = opts.title
    toastBody = opts.description
    openToast = true
  }

  function hideToast() {
    openToast = false
  }

  let presetTitleInput = $state('')
  let presetDescriptionInput = $state('')

  function addPreset() {
    
  }

  export const prerender = true;

</script>
<Styles />
{#if $isGalleryOpen}
  <Gallery></Gallery>
  {:else}
  <main class="bg-[#1A1A1A] flex flex-col justify-evenly items-center gap-8 py-12 px-4">
  
    <Modal body header={modalTitle} isOpen={openModal} toggle={toggleModal} theme="light" on:close={() => {
      modalSetInput = false
    }}>
      <p>{@html modalText}</p>
      {#if modalSetInput}
        <Input bind:value={configExportNameInput} placeholder="Insert your configuration name here (optional)" theme="light" type="text"/>
      {/if}
      <ModalFooter>
        {#if modalCallback !== null}
        <Button color="danger" onclick={async () => {
          if (modalCallback !== null) {
            await modalCallback()
            toggleModal()
          }
        }}>Confirm</Button>
        {#if !modalSetInput}
        <Button color="primary" onclick={() => {
          modalCallback = null
          toggleModal()
        }}>Cancel</Button>
        {/if}
        {:else}
        <Button color="primary" onclick={toggleModal}>Ok</Button>
        {/if}
      </ModalFooter>
    </Modal>
    <div class="fixed top-2 right-2">
      <Toast autohide body header={toastHeader} isOpen={openToast} on:close={() => (openToast = false)}>
        {@html toastBody}
      </Toast>
    </div>
  
  <section class="text-blue-500 flex flex-col md:flex-row gap-3 justify-center items-center">
    <h2 class="text-4xl">SinkinAI API frontend</h2>
    <p class="text-white">
      API keys Available: {$loadedApiKeys.length}
      <br/>
      Models saved: {$savedModels.length}
      <br/>
      Images saved: {$savedImages.length}
      <br/>
      LoRAs saved: {$savedLoras.length}
      <br/>
      Credits left: {$creditsLeft}
    </p>
    <div class="flex flex-col gap-1 justify-center items-center">
      <Button outline color="primary" onclick={() => {
        modalSetInput = true
        showConfirmationModal({
          title: 'Do you want to give a name for this save?',
          description: 'Add a name below',
          callbackFn: () => {
            exportSave("sinkinAPI-" + getDateFilename(undefined, configExportNameInput === '' ? undefined : configExportNameInput), {
              savedApiKeys: $loadedApiKeys,
              savedImages: $savedImages,
              savedLoRAs: $savedLoras,
              savedModels: $savedModels
            })
            modalSetInput = false
          }
        })
      }}>Export configuration</Button>
      <Button outline color="success" onclick={async () => {
        const file = await promptFile()
        if (file === null) {
          showToast({
            title: 'Select a valid file to import',
            description: 'The selected file should be exported from this application, if not, it can broke your saved data'
          })
          return
        }
        const result = await importSave(file, {
          savedApiKeys: $loadedApiKeys,
          savedImages: $savedImages,
          savedLoRAs: $savedLoras,
          savedModels: $savedModels
        })
        if (result) {
          showToast({
            title: 'The importation is done, please reload the page',
            description: 'The page will be reloaded automatically in 5 seconds'
          })
          setTimeout(() => {
            window.location.reload()
          }, 5000)
        } else {
          showToast({
            title: 'The file is invalid',
            description: 'Are you sure the file is a configuration file from this app? check console if so'
          })
        }
      }}>Import configuration</Button>
      <Button outline color="danger" onclick={() => {
        showConfirmationModal({
          title: 'Are you sure?',
          description: 'This wil <strong>DELETE ALL your saved data</strong>',
          callbackFn: () => {
            deleteAllImages(),
            deleteAllKeys(),
            deleteAllLoRAs(),
            deleteAllModels()
          }
        })
      }}>Delete configuration</Button>
    </div>
  </section>
  
  <section class="text-blue-500 flex flex-col gap-3 justify-center items-center min-w-[32%]">
    <h2>
      Generation Zone
    </h2>
    <textarea use:autosize bind:value={prompt} placeholder="Insert your prompt here" class="block p-2.5 w-full text-sm rounded-lg bg-[#212529] border-gray-600 placeholder-gray-300 text-white focus:ring-blue-500 focus:border-blue-500"></textarea>
    <Input bind:value={quantityOfImages} placeholder="Quantity of images" theme="dark" type="number"/>
    {#if $savedLoras.length > 0}
    <Input on:change={(e) => {
      loraSelected = $savedLoras.find(lora => lora.id === e.target.value) ?? noLora
      }} placeholder="Select a LoRA" theme="dark" type="select">
      {#each [noLora, ...$savedLoras] as option}
      <option value={option}>{option.title}</option>
    {/each}
    </Input>
    {:else}
    <Input placeholder="No LoRAs saved" theme="dark" type="number" disabled/>
    {/if}
    <!-- Model selection -->
    {#if $savedModels.length > 0}
    <Input bind:value={selectedModel} placeholder="Select a model" theme="dark" type="select">
      {#each $savedModels as option}
      <option value={option}>{option.title}</option>
    {/each}
    </Input>
    {:else}
    <Input placeholder="No models saved" theme="dark" type="number" disabled/>
    {/if}
    <h5>Base Image (Image to Image Generation)</h5>
    <Input bind:value={fileSelected} placeholder="Base Image" theme="dark" type="file" accept="image/*"/>
    <button onclick={() => advancedOptions = !advancedOptions}>
      <h5>{advancedOptions ? 'Hide' : 'Show'} advanced options</h5>
    </button>
    
    {#if advancedOptions}
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <h5>Scheduler</h5>
          <p>Default: DPMSolverMultistep or model's default</p>
          <Input bind:value={scheduler} placeholder="Select the scheduler" theme="dark" type="select">
            {#each ["DDIM", "K_EULER", "K_EULER_ANCESTRAL", "DPMSolverMultistep", "PNDM", "KLMS"] as scheduler}
            <option value={scheduler}>{scheduler}</option>
            {/each}
          </Input>
        </div>
        <div class="flex flex-col gap-1">
          <h5>LoRA scale</h5>
          <p>Default: 0.75</p>
          <Input bind:value={loraScale} placeholder="Insert the scale" theme="dark" type="number"/>
        </div>
        <div class="flex flex-col gap-1">
          <h5>Inference steps</h5>
          <p>Default: 30, range 1-50</p>
          <Input bind:value={numberOfInferenceSteps} placeholder="Inference steps" theme="dark" type="number"/>
        </div>
        <div class="flex flex-col gap-1">
          <h5>Negative prompt</h5>
          <Input bind:value={negativePrompt} placeholder="Negative prompt" theme="dark" type="text"/>
          <Input bind:value={useDefaultNegativePrompt} label="Use default negative prompt" theme="dark" type="checkbox" checked/>
        </div>
        <div class="flex flex-col gap-1">
          <h5>Width</h5>
          <p>Default: 512, max 896</p>
          <Input bind:value={width} placeholder="Select the width" theme="dark" type="select">
            {#each commonSizes as w}
            <option value={w}>{w}px</option>
            {/each}
          </Input>
        </div>
        <div class="flex flex-col gap-1">
          <h5>Height</h5>
          <p>Default: 768, max 896</p>
          <Input bind:value={height} placeholder="Select the height" theme="dark" type="select">
            {#each commonSizes as h}
            <option value={h}>{h}px</option>
            {/each}
          </Input>
        </div>
        <div class="flex flex-col gap-1">
          <h5>Guidance scale</h5>
          <p>Default: 7.5 or model's default, range 1-20</p>
          <Input bind:value={guidanceScale} placeholder="Guidance scale" theme="dark" type="number"/>
        </div>
        <div class="flex flex-col gap-1">
          <h5>Seed</h5>
          <p>Default: -1 (random)</p>
          <Input bind:value={seed} placeholder="Insert the seed" theme="dark" type="number"/>
        </div>
        <div class="flex flex-col gap-1">
          <h5>Model Version</h5>
          <p class="text-red-500">Warning: Do not touch this if you are unsure of the model versions</p>
          <Input bind:value={modelVersion} placeholder="Model version" theme="dark" type="number"/>
        </div>
      </div>
      {/if}
      <div class="flex flex-row gap-2">
        <Button outline color="primary" onclick={async () => {
          loading = true
          try {
            await generateNewImage()
      } catch (error) {
        console.error(error)
      }
      loading = false
      }} disabled={loading}>Generate image</Button>
    <Button outline color="warning" onclick={() => {
      isGalleryOpen.set(true)
    }} disabled={loading}>Go to the gallery</Button>
    </div>
    {#if loading}
    <div class="flex flex-row gap-2 justify-center items-center">
      <Spinner size="sm" color="primary" />
      <p class="mt-4 text-white">
        Waiting server response...
      </p>
    </div>
    {/if}
  </section>
  
  <section class="text-blue-500 flex flex-col gap-3 justify-center items-center">
    <h2>
      Loading zone
    </h2>
    <div class="flex flex-col gap-2">
      <h3>Manage API keys</h3>
      <p class="text-red-500">Warning: The API key should have 100 credits left if you want to add it</p>
      <Input bind:value={apiKeyInput} placeholder="Insert your API key here" theme="dark" />
      <div class="flex flex-col gap-1">
        <Button outline color="primary" onclick={() => {showApiKeyInformation()}}>Information</Button>
        <Button outline color="success" onclick={() => {addApiKey()}}>Add key</Button>
        <Button outline color="danger" onclick={() => {
          if (apiKeyInput === '') return
          showConfirmationModal({
            title: 'Are you sure?',
            description: 'This will <strong>DELETE</strong> your selected API key stored',
            callbackFn: removeApiKey
          })
        }}>Delete key</Button>
      </div>
    </div>
    <div class="flex flex-col gap-2">
      <h3>Manage Models</h3>
      <p class="text-red-500">Warning: The model should be a valid model within the SinkinAPI (only the ID)</p>
      <Input bind:value={modelIdInput} placeholder="Insert the model ID here" theme="dark" />
      <Input bind:value={modelTitleInput} placeholder="Insert the model title here" theme="dark" />
      <Input bind:value={modelDescriptionInput} placeholder="Insert the model description here" theme="dark" />
      <div class="flex flex-col gap-1">
        <Button outline color="success" onclick={() => {addModel()}}>Add model</Button>
        <Button outline color="danger" onclick={() => {
          if (modelIdInput === '') return
          showConfirmationModal({
            title: 'Are you sure?',
            description: 'This will <strong>DELETE</strong> your selected model stored',
            callbackFn: removeModel
          })
        }}>Delete model</Button>
      </div>
    </div>
    <div class="flex flex-col gap-2">
      <h3>Manage LoRAs</h3>
      <p class="text-red-500">Warning: The LoRA should be a valid within the SinkinAPI (only the ID)</p>
      <Input bind:value={loraIdInput} placeholder="Insert the LoRA ID here" theme="dark" />
      <Input bind:value={loraTitleInput} placeholder="Insert the LoRA title here" theme="dark" />
      <Input bind:value={loraDescriptionInput} placeholder="Insert the LoRA description here" theme="dark" />
      <div class="flex flex-col gap-1">
        <Button outline color="success" onclick={() => {addLoRA()}}>Add LoRA</Button>
        <Button outline color="danger" onclick={() => {
          if (loraIdInput === '') return
          showConfirmationModal({
            title: 'Are you sure?',
            description: 'This will <strong>DELETE</strong> your selected LoRA stored',
            callbackFn: removeLoRA
          })
        }}>Delete LoRA</Button>
      </div>
    </div>
    <div class="flex flex-col gap-2">
      <h3>Currently loaded data</h3>
      <p class="text-red-500">Warning: These buttons will massively delete a field of data, be careful</p>
      <div class="flex flex-col gap-1">
        <Button outline color="primary" onclick={
          () => {
            if ($loadedApiKeys.length === 0) {
              showToast({
                title: 'There are not any API keys stored yet',
                description: 'Add some first'
              })
            return
            }
            showModal({
              title: 'Stored API keys',
              description: JSON.stringify($loadedApiKeys, null, 2)
            })
          }
        }>View saved keys</Button>
        <Button outline color="primary" onclick={
          () => {
            if ($savedModels.length === 0) {
              showToast({
                title: 'There are not any models stored yet',
                description: 'Add some first'
              })
            return
            }
            showModal({
              title: 'Stored models',
              description: JSON.stringify($savedModels, null, 2)
            })
          }
        }>View saved models</Button>
        <Button outline color="primary" onclick={
          () => {
            if ($savedLoras.length === 0) {
              showToast({
                title: 'There are not any LoRA stored yet',
                description: 'Add some first'
              })
            return
            }
            showModal({
              title: 'Stored LoRAs',
              description: JSON.stringify($savedLoras, null, 2)
            })
          }
        }>View saved LoRAs</Button>
        <Button outline color="danger" onclick={() => {
          showConfirmationModal({
            title: 'Are you sure?',
            description: 'This will <strong>DELETE ALL</strong> your API keys stored',
            callbackFn: deleteAllKeys
          })
        }}>Delete saved keys</Button>
        <Button outline color="danger" onclick={() => {
          showConfirmationModal({
            title: 'Are you sure?',
            description: 'This will <strong>DELETE ALL</strong> your models saved',
            callbackFn: deleteAllModels
          })
        }}>Delete saved models</Button>
        <Button outline color="danger" onclick={() => {
          showConfirmationModal({
            title: 'Are you sure?',
            description: 'This will <strong>DELETE ALL</strong> your LoRAs saved',
            callbackFn: deleteAllLoRAs
          })
        }}>Delete saved LoRAs</Button>
        <Button outline color="danger" onclick={() => {
          showConfirmationModal({
            title: 'Are you sure?',
            description: 'This will <strong>DELETE ALL</strong> your images stored',
            callbackFn: deleteAllImages
          })
        }}>Delete generated images</Button>
      </div>
    </div>
  </section>
  </main>
{/if}