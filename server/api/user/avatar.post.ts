export default defineEventHandler(async (event) => {
  try {
    const form = await readFormData(event),
      image = form.get("image");

    if (!image) {
      return {
        success: false,
        message: "عکس پروفایل خود را انتخاب کنید",
        statusCode: 400,
      };
    }

    const formData = new FormData()
    formData.append("image", image)

    const response: any = await api(event, 'access-token')('/user/avatar', {
        method: "post",
        body: formData
    })
    
    return response
} catch (err) {
    return connectionResponseError();
  }
});
