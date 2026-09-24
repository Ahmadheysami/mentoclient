export default defineNuxtRouteMiddleware(async (to, from) => {
  const user = useUser(),
    auth = useAuth(),
    { hooks } = useNuxtApp();

    const access = await auth.checkToken('access-token')
    
    if (!access) {
      if (!to.path.startsWith("/auth")) {
        return await navigateTo("/auth")
      }
      
      return;
    }

    // fetch user data
    await user.getUser()
    
    if (user.state.user === null) {
      if (!to.path.startsWith("/auth")) {
        return await navigateTo("/auth")
      }
      return;
    }
    if (to.path.startsWith("/auth")) {
      if (user.state.user) {
        return await navigateTo("/")
      }
    }
});
