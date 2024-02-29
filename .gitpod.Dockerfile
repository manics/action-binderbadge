FROM gitpod/workspace-full:latest
# Try and use the same version as .github/workflows/*.yml
# https://www.gitpod.io/docs/languages/javascript#node-versions

# Ensure this matches .github/workflows/test.yml and .github/workflows/test-and-update.yml
RUN bash -c ". .nvm/nvm.sh && nvm install 20 && nvm use 20 && nvm alias default 20"

RUN echo "nvm use default &>/dev/null" >> ~/.bashrc.d/51-nvm-fix