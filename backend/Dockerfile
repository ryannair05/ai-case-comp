# ================================
# Build image
# ================================
FROM swift:6.1-noble AS build

# Install OS updates and poppler-utils for PDF text extraction
RUN export DEBIAN_FRONTEND=noninteractive DEBCONF_NONINTERACTIVE_SEEN=true \
    && apt-get -q update \
    && apt-get -q dist-upgrade -y \
    && apt-get install -y libjemalloc-dev poppler-utils

# Set up a build area
WORKDIR /build

# First just resolve dependencies.
# This creates a cached layer that can be reused
# as long as your Package.swift/Package.resolved
# files do not change.
COPY ./Package.* ./
RUN swift package resolve \
        $([ -f ./Package.resolved ] && echo "--force-resolved-versions" || true)

# Copy entire repo into container
COPY . .

RUN mkdir /staging

# Build the application with optimizations, static linking, and jemalloc
RUN --mount=type=cache,target=/build/.build \
    swift build -c release \
        --product App \
        --static-swift-stdlib \
        -Xlinker -ljemalloc && \
    # Copy main executable to staging area
    cp "$(swift build -c release --show-bin-path)/App" /staging && \
    # Copy resources bundled by SPM to staging area
    find -L "$(swift build -c release --show-bin-path)" -regex '.*\.resources$' -exec cp -Ra {} /staging \;

# Switch to the staging area
WORKDIR /staging

# Copy static swift backtracer binary to staging area
RUN cp "/usr/libexec/swift/linux/swift-backtrace-static" ./

# Copy any resources from the public directory if it exists
RUN [ -d /build/Public ] && { mv /build/Public ./Public && chmod -R a-w ./Public; } || true

# ================================
# Run image
# ================================
FROM ubuntu:noble

# Install runtime dependencies: jemalloc + poppler-utils for PDF text extraction
RUN export DEBIAN_FRONTEND=noninteractive DEBCONF_NONINTERACTIVE_SEEN=true \
    && apt-get -q update \
    && apt-get -q dist-upgrade -y \
    && apt-get -q install -y \
      libjemalloc2 \
      poppler-utils \
      ca-certificates \
      tzdata \
    && rm -r /var/lib/apt/lists/*

# Create a vapor user and group
RUN useradd --user-group --create-home --system --skel /dev/null --home-dir /app vapor

# Switch to /app
WORKDIR /app

# Copy built executable and staged resources from builder
COPY --from=build --chown=vapor:vapor /staging /app

# Crash reporter config
ENV SWIFT_BACKTRACE=enable=yes,sanitize=yes,threads=all,images=all,interactive=no,swift-backtrace=./swift-backtrace-static

# Run as vapor user
USER vapor:vapor

# Expose Vapor default port
EXPOSE 8080

# Start the Vapor service
ENTRYPOINT ["./App"]
CMD ["serve", "--env", "production", "--hostname", "0.0.0.0", "--port", "8080"]
